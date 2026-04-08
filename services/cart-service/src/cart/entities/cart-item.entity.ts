import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn
} from 'typeorm';
import { CartEntity } from './cart.entity';

@Entity('cart_items')
export class CartItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'cart_id' }) cartId: string;
  @Column({ name: 'variant_id' }) variantId: string;
  @Column({ type: 'int', default: 1 }) quantity: number;
  @Column({ name: 'added_at', default: () => 'NOW()' }) addedAt: Date;
  @ManyToOne(() => CartEntity, (c) => c.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' }) cart: CartEntity;
}
