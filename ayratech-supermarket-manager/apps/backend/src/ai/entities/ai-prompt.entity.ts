import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class AiPrompt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  content: string; // The actual prompt/instructions

  @Column({ default: 'product_analysis' })
  type: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: true })
  supportsImageAnalysis: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
