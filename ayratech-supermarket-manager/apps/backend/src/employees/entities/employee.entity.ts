import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import type { EmployeeCompensation } from './employee-compensation.entity';
import type { WorkSchedule } from '../../work-schedules/entities/work-schedule.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Person Data
  @Column()
  fullName: string; // nome_completo

  @Column({ unique: true })
  cpf: string;

  @Column({ nullable: true })
  rg: string;

  @Column({ type: 'date', nullable: true })
  birthDate: Date; // data_nascimento

  @Column()
  email: string;

  @Column()
  phone: string; // telefone

  // Address
  @Column()
  addressStreet: string; // endereco_logradouro

  @Column()
  addressNumber: string; // endereco_numero

  @Column()
  addressDistrict: string; // endereco_bairro

  @Column()
  addressCity: string; // endereco_cidade

  @Column()
  addressState: string; // endereco_estado

  @Column()
  addressZip: string; // endereco_cep

  // Link
  @Column({ unique: true })
  internalCode: string; // matricula_interna

  @Column({ nullable: true })
  roleId: string;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ nullable: true })
  supervisorId: string;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'supervisorId' })
  supervisor: Employee;

  @OneToMany(() => Employee, employee => employee.supervisor)
  subordinates: Employee[];

  @Column({ nullable: true })
  region: string; // unidade_regiao

  @Column()
  contractType: string; // tipo_contrato_trabalho: clt | pj | temporario | estagio

  @Column({ type: 'date' })
  admissionDate: Date; // data_admissao

  @Column({ type: 'date', nullable: true })
  terminationDate: Date; // data_desligamento

  @Column({ default: 'active' })
  status: string; // ativo | afastado | desligado

  // Security / App
  @Column({ nullable: true })
  facialPhotoUrl: string; // foto_facial_url

  @Column({ nullable: true })
  authorizedDeviceId: string; // device_id_autorizado

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date; // ultimo_login_em

  // Live Location
  @Column({ type: 'float', nullable: true })
  lastLatitude: number;

  @Column({ type: 'float', nullable: true })
  lastLongitude: number;

  @Column({ type: 'timestamp', nullable: true })
  lastLocationAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('EmployeeCompensation', (compensation: EmployeeCompensation) => compensation.employee)
  compensations: EmployeeCompensation[];

  @OneToMany('WorkSchedule', (schedule: WorkSchedule) => schedule.employee)
  workSchedules: WorkSchedule[];
}
