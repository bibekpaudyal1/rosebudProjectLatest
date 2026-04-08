import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, Index
} from 'typeorm';

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'variant_id', unique: true }) @Index() variantId: string;
  @Column({ type: 'int', default: 0 }) quantity: number;
  @Column({ type: 'int', default: 0 }) reserved: number;
  @Column({ name: 'low_stock_threshold', type: 'int', default: 10 }) lowStockThreshold: number;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  get available(): number { return Math.max(0, this.quantity - this.reserved); }
}
