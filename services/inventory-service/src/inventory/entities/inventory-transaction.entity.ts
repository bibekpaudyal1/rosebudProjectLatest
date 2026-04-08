import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index
} from 'typeorm';

@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'variant_id' }) @Index() variantId: string;
  @Column() type: string;
  @Column({ name: 'quantity_delta', type: 'int' }) quantityDelta: number;
  @Column({ name: 'reference_id', nullable: true }) referenceId: string;
  @Column({ nullable: true }) note: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
