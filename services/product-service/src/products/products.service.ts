import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { ProductStatus, UserRole } from '@bazarbd/types';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductSearchService } from './product-search.service';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly s3: S3Client;

  constructor(
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant) private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(ProductImage) private readonly imageRepo: Repository<ProductImage>,
    @InjectRedis() private readonly redis: Redis,
    private readonly searchService: ProductSearchService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${config.get('r2.accountId')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.get('r2.accessKeyId')!,
        secretAccessKey: config.get('r2.secretAccessKey')!,
      },
    });
  }

  async create(sellerId: string, dto: CreateProductDto): Promise<Product> {
    const slug = await this.generateUniqueSlug(dto.name);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect(); await qr.startTransaction();
    try {
      const product = qr.manager.create(Product, { ...dto, sellerId, slug, status: ProductStatus.DRAFT });
      const saved = await qr.manager.save(product);
      const variants = dto.variants.map((v) => qr.manager.create(ProductVariant, { ...v, productId: saved.id }));
      const savedVariants = await qr.manager.save(variants);
      for (const variant of savedVariants) {
        await qr.manager.query(
          `INSERT INTO inventory (variant_id, quantity, reserved, low_stock_threshold) VALUES ($1, $2, 0, 10)`,
          [variant.id, dto.variants.find((v) => v.sku === variant.sku)?.initialStock ?? 0],
        );
      }
      await qr.commitTransaction();
      const full = await this.productRepo.findOne({ where: { id: saved.id }, relations: ['variants', 'images'] });
      this.eventEmitter.emit('product.created', { productId: saved.id, sellerId, name: saved.name, categoryId: saved.categoryId });
      return full!;
    } catch (err) { await qr.rollbackTransaction(); throw err; }
    finally { await qr.release(); }
  }

  async findById(id: string, incrementView = false): Promise<Product> {
    if (!incrementView) {
      const cached = await this.redis.get(`product:${id}`);
      if (cached) return JSON.parse(cached);
    }
    const product = await this.productRepo.findOne({ where: { id }, relations: ['variants', 'images'] });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    if (incrementView) await this.productRepo.increment({ id }, 'viewCount', 1);
    await this.redis.setex(`product:${id}`, 600, JSON.stringify(product));
    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { slug, status: ProductStatus.ACTIVE }, relations: ['variants', 'images'] });
    if (!product) throw new NotFoundException(`Product '${slug}' not found`);
    await this.productRepo.increment({ slug }, 'viewCount', 1);
    return product;
  }

  async search(query: ProductQueryDto) {
    return this.searchService.search({
      query: query.search, categoryId: query.categoryId, sellerId: query.sellerId,
      minPrice: query.minPrice, maxPrice: query.maxPrice, minRating: query.minRating,
      sortBy: query.sortBy, sortOrder: query.sortOrder,
      page: query.page ?? 1, limit: Math.min(query.limit ?? 20, 100),
    });
  }

  async autocomplete(q: string): Promise<string[]> {
    if (!q || q.length < 2) return [];
    return this.searchService.autocomplete(q);
  }

  async update(id: string, sellerId: string, role: UserRole, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findById(id);
    this.assertOwner(product, sellerId, role);
    Object.assign(product, dto);
    if (dto.name) product.slug = await this.generateUniqueSlug(dto.name, id);
    const saved = await this.productRepo.save(product);
    await this.redis.del(`product:${id}`);
    await this.searchService.indexProduct(saved);
    this.eventEmitter.emit('product.updated', { productId: id, changes: dto });
    return saved;
  }

  async publish(id: string, sellerId: string, role: UserRole): Promise<Product> {
    const product = await this.findById(id);
    this.assertOwner(product, sellerId, role);
    if (!product.variants.length) throw new BadRequestException('Product must have at least one variant');
    product.status = ProductStatus.ACTIVE;
    product.publishedAt = new Date();
    const saved = await this.productRepo.save(product);
    await this.redis.del(`product:${id}`);
    await this.searchService.indexProduct(saved);
    return saved;
  }

  async unpublish(id: string, sellerId: string, role: UserRole): Promise<Product> {
    const product = await this.findById(id);
    this.assertOwner(product, sellerId, role);
    product.status = ProductStatus.INACTIVE;
    const saved = await this.productRepo.save(product);
    await this.redis.del(`product:${id}`);
    await this.searchService.removeProduct(id);
    return saved;
  }

  async uploadImage(productId: string, sellerId: string, role: UserRole, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<ProductImage> {
    const product = await this.findById(productId);
    this.assertOwner(product, sellerId, role);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('Only JPEG, PNG, WebP allowed');
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const key = `products/${productId}/${uuidv4()}.${ext}`;
    await this.s3.send(new PutObjectCommand({ Bucket: this.config.get('r2.bucketName')!, Key: key, Body: file.buffer, ContentType: file.mimetype, CacheControl: 'public, max-age=31536000' }));
    const url = `${this.config.get('r2.publicUrl')}/${key}`;
    const image = await this.imageRepo.save(this.imageRepo.create({ productId, url }));
    const count = await this.imageRepo.count({ where: { productId } });
    if (count === 1) { await this.productRepo.update(productId, { thumbnailUrl: url }); await this.redis.del(`product:${productId}`); }
    return image;
  }

  async deleteImage(imageId: string, sellerId: string, role: UserRole): Promise<void> {
    const image = await this.imageRepo.findOne({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found');
    const product = await this.findById(image.productId);
    this.assertOwner(product, sellerId, role);
    await this.imageRepo.remove(image);
  }

  private assertOwner(product: Product, requesterId: string, role: UserRole): void {
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR].includes(role);
    if (!isAdmin && product.sellerId !== requesterId) throw new ForbiddenException('You do not own this product');
  }

  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = name.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff\s]/g, '').replace(/\s+/g, '-');
    let slug = base; let i = 1;
    while (true) {
      const ex = await this.productRepo.findOne({ where: { slug } });
      if (!ex || ex.id === excludeId) break;
      slug = `${base}-${i++}`;
    }
    return slug;
  }
}
