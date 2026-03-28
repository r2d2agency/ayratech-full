import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Product } from '../../entities/product.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { RouteItem } from '../../routes/entities/route-item.entity';
import { Supermarket } from '../../entities/supermarket.entity';

export enum BreakageStatus {
  PENDING_INVOICE = 'PENDING_INVOICE',
  COMPLETED = 'COMPLETED',
}

@Entity()
export class BreakageReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column('int')
  quantity: number;

  @Column('simple-array', { nullable: true })
  photos: string[];

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: BreakageStatus,
    default: BreakageStatus.PENDING_INVOICE,
  })
  status: BreakageStatus;

  // Invoice Data (Devolução)
  @Column({ nullable: true })
  invoiceNumber: string;

  @Column({ type: 'date', nullable: true })
  invoiceDate: string;

  @Column({ nullable: true })
  invoicePhoto: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
