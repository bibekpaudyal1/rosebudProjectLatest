import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index
} from 'typeorm';
import { OrderStatus } from '@bazarbd/types';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'order_id' }) @Index() orderId: string;
  @Column({ name: 'seller_id' }) @Index() sellerId: string;
  @Column({ name: 'variant_id' }) variantId: string;
  @Column({ name: 'product_snapshot', type: 'jsonb' }) productSnapshot: Record<string, unknown>;
  @Column({ type: 'int' }) quantity: number;
  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 }) unitPrice: number;
  @Column({ name: 'total_price', type: 'decimal', precision: 12, scale: 2 }) totalPrice: number;
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING }) status: OrderStatus;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' }) order: Order;
}
