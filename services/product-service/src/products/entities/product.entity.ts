import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany, Index
} from 'typeorm';
import { ProductStatus } from '@bazarbd/types';
import { ProductVariant } from './product-variant.entity';
import { ProductImage } from './product-image.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'seller_id' }) @Index() sellerId: string;
  @Column({ name: 'category_id' }) @Index() categoryId: string;
  @Column({ name: 'brand_id', nullable: true }) brandId: string;
  @Column() @Index() name: string;
  @Column({ name: 'name_bn', nullable: true }) nameBn: string;
  @Column({ unique: true }) @Index() slug: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ name: 'short_desc', nullable: true }) shortDesc: string;
  @Column({ name: 'base_price', type: 'decimal', precision: 12, scale: 2 }) basePrice: number;
  @Column({ name: 'compare_price', type: 'decimal', precision: 12, scale: 2, nullable: true }) comparePrice: number;
  @Column({ name: 'thumbnail_url', nullable: true }) thumbnailUrl: string;
  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.DRAFT }) status: ProductStatus;
  @Column({ default: 'new' }) condition: string;
  @Column({ name: 'weight_grams', nullable: true }) weightGrams: number;
  @Column({ type: 'text', array: true, nullable: true }) tags: string[];
  @Column({ type: 'jsonb', default: '{}' }) attributes: Record<string, unknown>;
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 }) rating: number;
  @Column({ name: 'review_count', default: 0 }) reviewCount: number;
  @Column({ name: 'sold_count', default: 0 }) soldCount: number;
  @Column({ name: 'view_count', default: 0 }) viewCount: number;
  @Column({ name: 'is_featured', default: false }) isFeatured: boolean;
  @Column({ type: 'jsonb', default: '{}' }) metadata: Record<string, unknown>;
  @Column({ name: 'published_at', nullable: true }) publishedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  @OneToMany(() => ProductVariant, (v) => v.product, { cascade: true, eager: true })
  variants: ProductVariant[];

  @OneToMany(() => ProductImage, (i) => i.product, { cascade: true, eager: true })
  images: ProductImage[];
}
