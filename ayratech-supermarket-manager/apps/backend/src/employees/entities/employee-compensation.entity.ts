import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Employee } from './employee.entity';

@Entity('employee_compensation')
export class EmployeeCompensation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ insert: false, update: false })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'date' })
  validFrom: Date; // vigencia_inicio

  @Column({ type: 'date', nullable: true })
  validTo: Date; // vigencia_fim

  @Column()
  remunerationType: string; // tipo_remuneracao: mensal | hora | diaria | visita | comissao

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  baseSalary: number; // salario_base

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  hourlyRate: number; // valor_hora

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  dailyRate: number; // valor_diaria

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  visitRate: number; // valor_por_visita

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  monthlyAllowance: number; // ajuda_custo_mensal

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  transportVoucher: number; // vale_transporte

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  mealVoucher: number; // vale_refeicao

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  chargesPercentage: number; // encargos_percentual

  @Column({ type: 'text', nullable: true })
  notes: string; // observacoes

  @CreateDateColumn()
  createdAt: Date;
}
