import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Category } from '../category/category.entity';
import { Cart } from '../cart/cart.entity';
import { OrderItem } from '../order/order-item.entity';
import { Feedback } from '../feedback/feedback.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  price: number;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: 'bytea', nullable: true })
  imageData: Buffer;

  @Column({ nullable: true })
  imageMimeType: string; // e.g., 'image/jpeg', 'image/png'

  @Column()
  stock: number;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  createdAt: Date;

  @Column()
  categoryId: number;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @OneToMany(() => Cart, (cart) => cart.product, { cascade: true })
  cartItems: Cart[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product, {
    cascade: true,
  })
  orderItems: OrderItem[];

  @OneToMany(() => Feedback, (feedback) => feedback.product, { cascade: true })
  feedbacks: Feedback[];
}
