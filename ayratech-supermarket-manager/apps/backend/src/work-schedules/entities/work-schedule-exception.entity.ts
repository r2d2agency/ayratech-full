import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('work_schedule_exceptions')
export class WorkScheduleException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ insert: false, update: false })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'date' })
  date: Date; // data

  @Column()
  type: string; // tipo: folga | troca_horario | plantao | banco_horas

  @Column({ type: 'time', nullable: true })
  startTime: string; // hora_entrada

  @Column({ type: 'time', nullable: true })
  endTime: string; // hora_saida

  @Column({ type: 'text', nullable: true })
  reason: string; // motivo

  @CreateDateColumn()
  createdAt: Date;
}
