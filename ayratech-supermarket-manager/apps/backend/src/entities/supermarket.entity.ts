import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, ManyToMany } from 'typeorm';
import { SupermarketGroup } from '../supermarket-groups/entities/supermarket-group.entity';
import { Client } from './client.entity';
import { Product } from './product.entity';

@Entity()
export class Supermarket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fantasyName: string;

  @Column({ nullable: true })
  cnpj: string;

  @ManyToOne(() => SupermarketGroup, (group) => group.supermarkets, { eager: true })
  @JoinColumn({ name: 'groupId' })
  group: SupermarketGroup;

  @Column({ nullable: true })
  groupId: string; // Helpful for DTO mapping

  @Column()
  classification: string;

  // Address Fields
  @Column({ nullable: true })
  zipCode: string;

  @Column({ nullable: true })
  street: string;

  @Column({ nullable: true })
  number: string;

  @Column({ nullable: true })
  neighborhood: string;

  @Column({ nullable: true })
  complement: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ default: true })
  status: boolean;

  @ManyToMany(() => Client, (client) => client.supermarkets)
  clients: Client[];

  @ManyToMany(() => Product, (product) => product.supermarkets, { cascade: true })
  products: Product[];
}
