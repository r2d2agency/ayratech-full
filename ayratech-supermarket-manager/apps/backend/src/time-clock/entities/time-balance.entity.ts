import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('time_balances')
export class TimeBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column()
  competence: string; // YYYY-MM

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  expectedHours: number; // horas_previstas

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  workedHours: number; // horas_trabalhadas

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  overtimeHours: number; // horas_extras

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balanceHours: number; // saldo_banco_horas

  @CreateDateColumn()
  createdAt: Date;
}
