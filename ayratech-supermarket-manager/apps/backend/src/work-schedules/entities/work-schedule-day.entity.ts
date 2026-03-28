import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { WorkSchedule } from './work-schedule.entity';

@Entity('work_schedule_days')
export class WorkScheduleDay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ insert: false, update: false })
  workScheduleId: string;

  @ManyToOne(() => WorkSchedule, schedule => schedule.days, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workScheduleId' })
  workSchedule: WorkSchedule;

  @Column()
  dayOfWeek: number; // 0=dom ... 6=sab

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'time' })
  startTime: string; // hora_entrada

  @Column({ type: 'time' })
  endTime: string; // hora_saida

  @Column({ type: 'time', nullable: true })
  breakStart: string; // inicio_intervalo

  @Column({ type: 'time', nullable: true })
  breakEnd: string; // fim_intervalo

  @Column({ default: 10 })
  toleranceMinutes: number; // tolerancia_minutos

  @CreateDateColumn()
  createdAt: Date;
}
