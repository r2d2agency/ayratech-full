import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { EmployeeDocument } from '../../employees/entities/employee-document.entity';

@Entity('absence_requests')
export class AbsenceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column()
  type: string; // falta | atestado | atraso | saída_antecipada | folga

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'time', nullable: true })
  startTime: string;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'time', nullable: true })
  endTime: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ nullable: true })
  medicalCid: string;

  @Column({ nullable: true })
  medicalProfessionalName: string;

  @Column({ nullable: true })
  medicalServiceLocation: string;

  @Column({ nullable: true })
  medicalLicenseType: string; // CRM | COREN | outros

  @Column({ nullable: true })
  medicalLicenseNumber: string;

  @Column({ nullable: true })
  employeeDocumentId: string;

  @ManyToOne(() => EmployeeDocument, { nullable: true })
  @JoinColumn({ name: 'employeeDocumentId' })
  employeeDocument: EmployeeDocument;

  @Column({ nullable: true })
  fileUrl: string; // MinIO

  @Column({ default: 'pending' })
  status: string; // pendente | aprovado | recusado

  @Column({ nullable: true })
  approverId: string;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'approverId' })
  approver: Employee;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
