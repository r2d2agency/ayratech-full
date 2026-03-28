import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Client } from '../entities/client.entity';
import { ContractTemplate } from './contract-template.entity';

@Entity()
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  description: string;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @Column({ nullable: true })
  value: number;

  // @Column({ default: true })
  // status: boolean;

  @ManyToOne(() => Client, { eager: true, createForeignKeyConstraints: false })
  client: Client;

  @Column({ nullable: true })
  clientId: string;

  @ManyToOne(() => ContractTemplate, { eager: true, nullable: true, createForeignKeyConstraints: false })
  template: ContractTemplate;

  @Column({ nullable: true })
  templateId: string;

  @Column({ type: 'text', nullable: true })
  content: string; // The generated HTML content specific to this contract
}
