import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToMany, JoinColumn
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'parent_id', nullable: true }) parentId: string;
  @Column() name: string;
  @Column({ name: 'name_bn', nullable: true }) nameBn: string;
  @Column({ unique: true }) slug: string;
  @Column({ nullable: true }) description: string;
  @Column({ name: 'image_url', nullable: true }) imageUrl: string;
  @Column({ name: 'display_order', default: 0 }) displayOrder: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @ManyToOne(() => Category, (c) => c.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Category;

  @OneToMany(() => Category, (c) => c.parent)
  children: Category[];
}
