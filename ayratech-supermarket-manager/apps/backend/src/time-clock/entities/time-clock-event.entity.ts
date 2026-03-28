import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('time_clock_events')
export class TimeClockEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column()
  eventType: string; // entrada | saida | pausa_inicio | pausa_fim

  @Column({ type: 'timestamp' })
  timestamp: Date; // data_hora

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ nullable: true })
  storeId: string; // se bateu ponto em loja

  @Column({ nullable: true })
  routeId: string;

  @Column({ nullable: true })
  deviceId: string;

  @Column({ nullable: true })
  facialPhotoUrl: string;

  @Column({ default: 'pending' })
  validationStatus: string; // pendente | aprovado | recusado | suspeito

  @Column({ nullable: true })
  validationReason: string; // validacao_motivo

  @Column({ default: false })
  isManual: boolean;

  @Column({ nullable: true })
  editedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
