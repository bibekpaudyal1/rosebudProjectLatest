import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index
} from 'typeorm';

@Entity('payment_refunds')
export class PaymentRefund {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'payment_id' }) @Index() paymentId: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) amount: number;
  @Column({ nullable: true }) reason: string;
  @Column({ name: 'gateway_refund_id', nullable: true }) gatewayRefundId: string;
  @Column({ default: 'pending' }) status: string;
  @Column({ name: 'processed_at', nullable: true }) processedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
