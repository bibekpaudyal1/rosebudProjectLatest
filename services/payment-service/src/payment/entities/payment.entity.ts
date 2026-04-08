import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';
import { PaymentMethod, PaymentStatus } from '@bazarbd/types';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'order_id' }) @Index() orderId: string;
  @Column({ type: 'enum', enum: PaymentMethod }) gateway: PaymentMethod;
  @Column({ name: 'gateway_txn_id', nullable: true }) @Index() gatewayTxnId: string;
  @Column({ name: 'gateway_order_id', nullable: true }) gatewayOrderId: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) amount: number;
  @Column({ default: 'BDT' }) currency: string;
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.INITIATED })
  @Index() status: PaymentStatus;
  @Column({ name: 'gateway_response', type: 'jsonb', default: '{}' })
  gatewayResponse: Record<string, unknown>;
  @Column({ name: 'failure_reason', nullable: true }) failureReason: string;
  @Column({ name: 'paid_at', nullable: true }) paidAt: Date;
  @Column({ name: 'refunded_at', nullable: true }) refundedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
