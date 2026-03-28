import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { Client } from './client.entity';
import { Product } from './product.entity';

import { ChecklistTemplate } from '../checklists/entities/checklist-template.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Supermarket } from './supermarket.entity';
import { BrandAvailabilityWindow } from '../brands/entities/brand-availability-window.entity';

@Entity()
export class Brand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ nullable: true, insert: false, update: false })
  clientId: string;

  @ManyToOne(() => ChecklistTemplate, { nullable: true })
  @JoinColumn({ name: 'checklistTemplateId' })
  checklistTemplate: ChecklistTemplate;

  @Column({ nullable: true })
  checklistTemplateId: string;

  @Column({ default: false })
  waitForStockCount: boolean;

  @Column({ nullable: true })
  stockNotificationContact: string;

  @Column({ nullable: true })
  inventoryFrequency: string; // 'daily', 'weekly', 'biweekly', 'monthly'

  @Column({ type: 'int', nullable: true })
  inventoryFrequencyDays: number;

  @Column({ default: true })
  inventoryPostponeUntilWeekEnd: boolean;

  @Column({ default: true })
  inventoryPostponeRequiresJustification: boolean;

  @Column({ type: 'int', default: 10 })
  inventoryMaxPostponesPerWeek: number;

  @OneToMany(() => BrandAvailabilityWindow, (w) => w.brand, { cascade: true })
  availabilityWindows: BrandAvailabilityWindow[];

  @ManyToMany(() => Employee, { cascade: false })
  @JoinTable({ name: 'brand_promoters' })
  promoters: Employee[];

  @ManyToMany(() => Supermarket, { cascade: false })
  @JoinTable({ name: 'brand_supermarkets' })
  supermarkets: Supermarket[];

  @OneToMany(() => Product, product => product.brand)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
