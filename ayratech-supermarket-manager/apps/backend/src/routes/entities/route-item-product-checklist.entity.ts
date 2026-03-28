import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { RouteItemProduct } from './route-item-product.entity';
import { ChecklistItemType } from '../../checklists/entities/checklist-template-item.entity';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('route_item_product_checklists')
export class RouteItemProductChecklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => RouteItemProduct, (rip) => rip.checklists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeItemProductId' })
  routeItemProduct: RouteItemProduct;

  @Column()
  routeItemProductId: string;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'completedById' })
  completedBy: Employee;

  @Column({ nullable: true })
  completedById: string;

  @Column()
  description: string;

  @Column({
    type: 'enum',
    enum: ChecklistItemType,
    default: ChecklistItemType.SIMPLE
  })
  type: ChecklistItemType;

  @Column({ default: false })
  isChecked: boolean;

  @Column({ nullable: true })
  value: string; // URL for PHOTO, Date for VALIDITY_CHECK, Price for PRICE_CHECK

  @Column({ nullable: true })
  competitorName: string;

  @CreateDateColumn()
  checkTime: Date;
}
