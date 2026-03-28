import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { RouteItem } from './route-item.entity';
import { Employee } from '../../employees/entities/employee.entity';

@Entity()
export class RouteItemCheckin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => RouteItem, (item) => item.checkins, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeItemId' })
  routeItem: RouteItem;

  @Column()
  routeItemId: string;

  @ManyToOne(() => Employee, { eager: true })
  @JoinColumn({ name: 'promoterId' })
  promoter: Employee;

  @Column()
  promoterId: string;

  @Column({ type: 'timestamp' })
  checkInTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkOutTime: Date;

  @Column({ type: 'text', nullable: true })
  entryPhoto: string;

  @Column({ type: 'text', nullable: true })
  exitPhoto: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
