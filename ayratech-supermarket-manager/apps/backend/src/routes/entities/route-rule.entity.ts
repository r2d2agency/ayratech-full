import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class RouteRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ type: 'text', nullable: true })
  value: string; // JSON string for flexible rules

  @Column({ default: true })
  active: boolean;
}
