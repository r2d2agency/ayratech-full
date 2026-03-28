import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { Supermarket } from '../../entities/supermarket.entity';
import { Product } from '../../entities/product.entity';

@Entity()
export class SupermarketGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: true })
  status: boolean;

  @OneToMany(() => Supermarket, (supermarket) => supermarket.group)
  supermarkets: Supermarket[];

  @ManyToMany(() => Product, (product) => product.supermarketGroups)
  @JoinTable({ name: 'supermarket_group_products' })
  products: Product[];
}
