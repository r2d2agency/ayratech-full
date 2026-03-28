import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { RouteItem } from './route-item.entity';
import { Brand } from '../../entities/brand.entity';
import { ChecklistTemplate } from '../../checklists/entities/checklist-template.entity';

@Entity()
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', nullable: true })
  date: string;

  @ManyToOne(() => Employee, { eager: true, nullable: true })
  @JoinColumn({ name: 'promoterId' })
  promoter: Employee;

  @Column({ nullable: true })
  promoterId: string;

  @ManyToMany(() => Employee, { eager: true })
  @JoinTable({
    name: 'route_promoters',
    joinColumn: { name: 'routeId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'employeeId', referencedColumnName: 'id' }
  })
  promoters: Employee[];

  @Column({ default: 'DRAFT' })
  status: string;

  @Column({ default: 'VISIT' })
  type: string;

  @Column({ nullable: true })
  brandId: string;

  @ManyToOne(() => Brand, { nullable: true })
  @JoinColumn({ name: 'brandId' })
  brand: Brand;

  @Column({ nullable: true })
  checklistTemplateId: string;

  @ManyToOne(() => ChecklistTemplate, { nullable: true })
  @JoinColumn({ name: 'checklistTemplateId' })
  checklistTemplate: ChecklistTemplate;

  @Column({ default: false })
  isTemplate: boolean;

  @Column({ nullable: true })
  templateName: string;

  @Column({ nullable: true })
  recurrenceGroup: string;

  @OneToMany(() => RouteItem, (item) => item.route, { cascade: true, eager: true })
  items: RouteItem[];
}
