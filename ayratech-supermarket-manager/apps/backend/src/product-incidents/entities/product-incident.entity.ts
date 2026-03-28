import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../../entities/product.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { RouteItem } from '../../routes/entities/route-item.entity';
import { Supermarket } from '../../entities/supermarket.entity';

export enum ProductIncidentType {
  RUPTURE = 'RUPTURE',
  DEGUSTATION = 'DEGUSTATION',
  VALIDITY = 'VALIDITY',
}

export enum ProductIncidentLocation {
  STORE = 'STORE',
  STOCK = 'STOCK',
}

@Entity()
export class ProductIncident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ProductIncidentType })
  type: ProductIncidentType;

  @ManyToOne(() => Product, { eager: true })
  product: Product;

  @Column()
  productId: string;

  @ManyToOne(() => Employee, { eager: true })
  promoter: Employee;

  @Column()
  promoterId: string;

  @ManyToOne(() => RouteItem, { nullable: true })
  routeItem: RouteItem;

  @Column({ nullable: true })
  routeItemId: string;

  @ManyToOne(() => Supermarket, { nullable: true, eager: true })
  supermarket: Supermarket;

  @Column({ nullable: true })
  supermarketId: string;

  @Column({ type: 'int', nullable: true })
  quantity: number;

  @Column({ type: 'date', nullable: true })
  validityDate: string;

  @Column({ type: 'enum', enum: ProductIncidentLocation, nullable: true })
  location: ProductIncidentLocation;

  @Column({ type: 'uuid', nullable: true })
  reasonId: string;

  @Column({ nullable: true })
  reasonLabel: string;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
