import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany, Index,
  ManyToOne, JoinColumn
} from 'typeorm';
import { OrderStatus, PaymentMethod } from '@bazarbd/types';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'order_number', unique: true }) @Index() orderNumber: string;
  @Column({ name: 'customer_id' }) @Index() customerId: string;
  @Column({ name: 'address_id', nullable: true }) addressId: string;
  @Column({ name: 'shipping_address', type: 'jsonb' }) shippingAddress: Record<string, unknown>;
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING }) @Index() status: OrderStatus;
  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod }) paymentMethod: PaymentMethod;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) subtotal: number;
  @Column({ name: 'shipping_fee', type: 'decimal', precision: 12, scale: 2, default: 0 }) shippingFee: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) discount: number;
  @Column({ name: 'coupon_code', nullable: true }) couponCode: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) total: number;
  @Column({ nullable: true }) notes: string;
  @Column({ type: 'jsonb', default: '{}' }) metadata: Record<string, unknown>;
  @Column({ name: 'confirmed_at', nullable: true }) confirmedAt: Date;
  @Column({ name: 'delivered_at', nullable: true }) deliveredAt: Date;
  @Column({ name: 'cancelled_at', nullable: true }) cancelledAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true }) items: OrderItem[];
}

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
  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'order_id' }) order: Order;
}