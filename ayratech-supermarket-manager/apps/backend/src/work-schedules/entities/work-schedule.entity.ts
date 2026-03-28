import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { WorkScheduleDay } from './work-schedule-day.entity';

@Entity('work_schedules')
export class WorkSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'date' })
  validFrom: Date; // vigencia_inicio

  @Column({ type: 'date', nullable: true })
  validTo: Date; // vigencia_fim

  @Column({ default: 'America/Sao_Paulo' })
  timezone: string;

  @Column({ nullable: true })
  weeklyHours: number; // carga_horas_semanais

  @OneToMany(() => WorkScheduleDay, day => day.workSchedule, { cascade: true })
  days: WorkScheduleDay[];

  @CreateDateColumn()
  createdAt: Date;
}
