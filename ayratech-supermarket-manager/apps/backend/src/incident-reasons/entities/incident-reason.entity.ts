import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum IncidentReasonType {
  BREAKAGE = 'BREAKAGE',
  RUPTURE = 'RUPTURE',
  DEGUSTATION = 'DEGUSTATION',
  VALIDITY = 'VALIDITY',
}

@Entity()
export class IncidentReason {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: IncidentReasonType })
  type: IncidentReasonType;

  @Column()
  label: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
