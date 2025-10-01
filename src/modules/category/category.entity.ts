import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Product } from '../product/product.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  description: string;
  
  @Column({ nullable: true })
  nameFa: string;

  @Column({ nullable: true })
  descriptionFa: string;


  @Column()
  createdAt: Date;

  @OneToMany(() => Product, (product) => product.category, { cascade: true })
  products: Product[];
}