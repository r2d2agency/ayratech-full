import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ContractTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  content: string; // HTML content from docx

  @Column({ nullable: true })
  originalFileName: string;

  @Column({ default: true })
  status: boolean;
}
