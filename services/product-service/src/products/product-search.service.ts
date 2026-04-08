import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Product } from './entities/product.entity';

const PRODUCTS_INDEX = 'bazarbd_products';

@Injectable()
export class ProductSearchService implements OnModuleInit {
  private readonly logger = new Logger(ProductSearchService.name);
  constructor(private readonly es: ElasticsearchService) {}

  async onModuleInit() { await this.ensureIndex(); }

  async ensureIndex(): Promise<void> {
    const exists = await this.es.indices.exists({ index: PRODUCTS_INDEX });
    if (exists) return;
    await this.es.indices.create({
      index: PRODUCTS_INDEX,
      body: {
        settings: { number_of_shards: 2, number_of_replicas: 1 },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text', analyzer: 'standard', fields: { keyword: { type: 'keyword' } } },
            nameBn: { type: 'text' },
            description: { type: 'text' },
            categoryId: { type: 'keyword' },
            sellerId: { type: 'keyword' },
            slug: { type: 'keyword' },
            basePrice: { type: 'float' },
            rating: { type: 'float' },
            soldCount: { type: 'integer' },
            tags: { type: 'keyword' },
            status: { type: 'keyword' },
            thumbnailUrl: { type: 'keyword', index: false },
            isFeatured: { type: 'boolean' },
            createdAt: { type: 'date' },
          },
        },
      },
    });
    this.logger.log(`Index '${PRODUCTS_INDEX}' created`);
  }

  async indexProduct(product: Product): Promise<void> {
    await this.es.index({
      index: PRODUCTS_INDEX,
      id: product.id,
      document: {
        id: product.id, name: product.name, nameBn: product.nameBn,
        description: product.description, categoryId: product.categoryId,
        sellerId: product.sellerId, slug: product.slug,
        basePrice: Number(product.basePrice), rating: Number(product.rating),
        soldCount: product.soldCount, tags: product.tags ?? [],
        status: product.status, thumbnailUrl: product.thumbnailUrl,
        isFeatured: product.isFeatured, createdAt: product.createdAt,
      },
    });
  }

  async removeProduct(productId: string): Promise<void> {
    await this.es.delete({ index: PRODUCTS_INDEX, id: productId }).catch(() => {});
  }

  async search(params: {
    query?: string; categoryId?: string; sellerId?: string;
    minPrice?: number; maxPrice?: number; minRating?: number;
    sortBy?: string; sortOrder?: 'asc' | 'desc'; page: number; limit: number;
  }) {
    const { query, categoryId, sellerId, minPrice, maxPrice, minRating, sortBy, sortOrder, page, limit } = params;
    const must: any[] = [{ term: { status: 'active' } }];
    const filter: any[] = [];

    if (query) {
      must.push({ multi_match: { query, fields: ['name^3', 'nameBn^3', 'description', 'tags^2'], fuzziness: 'AUTO' } });
    }
    if (categoryId) filter.push({ term: { categoryId } });
    if (sellerId) filter.push({ term: { sellerId } });
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.push({ range: { basePrice: { gte: minPrice, lte: maxPrice } } });
    }
    if (minRating !== undefined) filter.push({ range: { rating: { gte: minRating } } });

    const sortField = sortBy === 'price' ? 'basePrice' : sortBy === 'rating' ? 'rating' : sortBy === 'popularity' ? 'soldCount' : '_score';
    const result = await this.es.search({
      index: PRODUCTS_INDEX,
      from: (page - 1) * limit,
      size: limit,
      query: { bool: { must, filter } },
      sort: [{ [sortField]: { order: sortOrder ?? 'desc' } }],
    });

    const total = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value ?? 0;
    return { data: result.hits.hits.map((h: any) => h._source), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async autocomplete(query: string): Promise<string[]> {
    const result = await this.es.search({
      index: PRODUCTS_INDEX, size: 8,
      query: { bool: { must: [{ term: { status: 'active' } }, { multi_match: { query, fields: ['name', 'nameBn'], type: 'phrase_prefix' } }] } },
      _source: ['name'],
    });
    return result.hits.hits.map((h: any) => h._source.name);
  }
}
