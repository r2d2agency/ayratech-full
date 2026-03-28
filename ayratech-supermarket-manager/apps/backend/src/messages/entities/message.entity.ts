import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ nullable: true })
  senderId: string;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'receiverId' })
  receiver: User;

  @Column({ nullable: true })
  receiverId: string;

  @Column({ default: false })
  read: boolean;

  @Column({ default: 'TEXT' }) // TEXT, ALERT, TASK
  type: string;

  @CreateDateColumn()
  createdAt: Date;
}
