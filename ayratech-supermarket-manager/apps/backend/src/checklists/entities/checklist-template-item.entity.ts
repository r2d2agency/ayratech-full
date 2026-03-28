import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { ChecklistTemplate } from './checklist-template.entity';
import { Competitor } from '../../competitors/entities/competitor.entity';

export enum ChecklistItemType {
  SIMPLE = 'SIMPLE',
  PHOTO = 'PHOTO',
  VALIDITY_CHECK = 'VALIDITY_CHECK',
  PRICE_CHECK = 'PRICE_CHECK',
  STOCK_COUNT = 'STOCK_COUNT'
}

@Entity('checklist_template_items')
export class ChecklistTemplateItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  description: string;

  @Column({
    type: 'enum',
    enum: ChecklistItemType,
    default: ChecklistItemType.SIMPLE
  })
  type: ChecklistItemType;

  @Column({ default: false })
  isMandatory: boolean;

  @Column({ default: 0 })
  order: number;

  @ManyToOne(() => ChecklistTemplate, (template) => template.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'templateId' })
  template: ChecklistTemplate;

  @Column()
  templateId: string;

  @ManyToOne(() => Competitor, { nullable: true, eager: true })
  @JoinColumn({ name: 'competitorId' })
  competitor: Competitor;

  @Column({ nullable: true })
  competitorId: string;

  @ManyToMany(() => Competitor, { eager: true })
  @JoinTable()
  competitors: Competitor[];
}
