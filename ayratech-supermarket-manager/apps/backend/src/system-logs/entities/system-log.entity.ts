import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('system_logs')
export class SystemLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  level: string; // error, warn, info, debug

  @Column()
  message: string;

  @Column({ type: 'text', nullable: true })
  stack: string;

  @Column({ type: 'text', nullable: true })
  context: string; // Controller/Service name or HTTP method/path

  @Column({ nullable: true })
  userId: string; // ID of the user who triggered the error (if available)

  @Column({ type: 'json', nullable: true })
  metadata: any; // Extra data (body, params, etc.)

  @CreateDateColumn()
  createdAt: Date;
}
