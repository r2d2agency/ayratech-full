import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { RouteItem } from './route-item.entity';
import { Product } from '../../entities/product.entity';
import { RouteItemProductChecklist } from './route-item-product-checklist.entity';
import { Employee } from '../../employees/entities/employee.entity';

@Entity()
export class RouteItemProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => RouteItem, (item) => item.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeItemId' })
  routeItem: RouteItem;

  @Column()
  routeItemId: string;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  productId: string;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'completedById' })
  completedBy: Employee;

  @Column({ nullable: true })
  completedById: string;

  @Column({ default: false })
  checked: boolean;

  @Column({ default: false })
  isStockout: boolean;

  @Column({ nullable: true })
  stockoutType: string; // 'VIRTUAL', 'PHYSICAL'

  @Column({ nullable: true, type: 'timestamp' })
  checkInTime: Date;

  @Column({ nullable: true, type: 'timestamp' })
  checkOutTime: Date;

  @Column('text', { array: true, nullable: true })
  photos: string[];

  @Column({ default: 'UNCHECKED' })
  aiStatus: string; // UNCHECKED, OK, FLAGGED

  @Column({ nullable: true })
  aiObservation: string;

  @Column({ nullable: true, type: 'date' })
  validityDate: string;

  @Column({ nullable: true, type: 'int' })
  validityQuantity: number;

  @Column({ nullable: true, type: 'date' })
  validityStoreDate: string;

  @Column({ nullable: true, type: 'int' })
  validityStoreQuantity: number;

  @Column({ nullable: true, type: 'date' })
  validityStockDate: string;

  @Column({ nullable: true, type: 'int' })
  validityStockQuantity: number;

  @Column({ nullable: true, type: 'int' })
  stockCount: number;

  @Column({ nullable: true, type: 'int' })
  gondolaCount: number;

  @Column({ nullable: true, type: 'int' })
  inventoryCount: number;

  @Column({ nullable: true })
  ruptureReason: string;

  @Column({ default: 'NONE' })
  stockCountStatus: string; // NONE, PENDING_REVIEW, APPROVED, REJECTED

  @Column({ nullable: true })
  approvalToken: string; // Token for public/quick approval link

  @Column({ nullable: true })
  observation: string;

  @Column({ nullable: true })
  checklistTemplateId: string;

  @Column('text', { array: true, nullable: true })
  checklistTypes: string[];

  @Column({ default: false })
  requiresStockPhotos: boolean;

  @OneToMany(() => RouteItemProductChecklist, (checklist) => checklist.routeItemProduct, { cascade: true, eager: true })
  checklists: RouteItemProductChecklist[];
}
