import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'product_id' }) @Index() productId: string;
  @Column({ unique: true }) sku: string;
  @Column() name: string;
  @Column({ type: 'jsonb', default: '{}' }) attributes: Record<string, string>;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) price: number;
  @Column({ name: 'compare_price', type: 'decimal', precision: 12, scale: 2, nullable: true }) comparePrice: number;
  @Column({ name: 'image_url', nullable: true }) imageUrl: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  @ManyToOne(() => Product, (p) => p.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
