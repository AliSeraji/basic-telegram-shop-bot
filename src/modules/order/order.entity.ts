import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../user/user.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from '../payment/payment.entity';
import { Delivery } from '../delivery/delivery.entity';
import { ORDER_STATUS } from '../../common/constants';

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  totalAmount: number;

  @Column({ type: 'enum', enum: ORDER_STATUS })
  status: (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

  @Column()
  createdAt: Date;

  @Column({ nullable: true })
  updatedAt: Date;

  @Column({ nullable: true })
  trackingNumber: string;

  @Column({ type: 'bytea', nullable: true })
  receiptImage: Buffer;

  @Column({ nullable: true })
  receiptImageMimeType: string;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, { cascade: true })
  orderItems: OrderItem[];

  @OneToMany(() => Payment, (payment) => payment.order, { cascade: true })
  payments: Payment[];

  @OneToMany(() => Delivery, (delivery) => delivery.order, { cascade: true })
  deliveries: Delivery[];
}
