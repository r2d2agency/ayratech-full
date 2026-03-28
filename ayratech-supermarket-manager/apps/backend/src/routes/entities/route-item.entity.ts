import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Route } from './route.entity';
import { Supermarket } from '../../entities/supermarket.entity';
import { RouteItemProduct } from './route-item-product.entity';
import { RouteItemCheckin } from './route-item-checkin.entity';

@Entity()
export class RouteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Route, (route) => route.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeId' })
  route: Route;

  @Column({ nullable: true })
  routeId: string;

  @ManyToOne(() => Supermarket, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supermarketId' })
  supermarket: Supermarket;

  @Column()
  supermarketId: string;

  @Column()
  order: number;

  @Column({ nullable: true })
  startTime: string; // HH:mm

  @Column({ nullable: true })
  endTime: string; // HH:mm

  @Column({ nullable: true })
  estimatedDuration: number; // in minutes

  @Column({ default: 'PENDING' }) // PENDING, CHECKIN, CHECKOUT, SKIPPED
  status: string;

  @Column({ nullable: true, type: 'timestamp' })
  checkInTime: Date;

  @Column({ nullable: true, type: 'timestamp' })
  checkOutTime: Date;

  @Column({ nullable: true })
  manualEntryBy: string;

  @Column({ nullable: true, type: 'timestamp' })
  manualEntryAt: Date;

  @Column({ nullable: true, type: 'text' })
  observation: string;

  @Column('simple-json', { nullable: true })
  categoryPhotos: Record<string, { before?: string | string[]; after?: string | string[]; storage?: string | string[] }>;

  @OneToMany(() => RouteItemProduct, (product) => product.routeItem, { cascade: true, eager: true })
  products: RouteItemProduct[];

  @OneToMany(() => RouteItemCheckin, (checkin) => checkin.routeItem, { cascade: true, eager: true })
  checkins: RouteItemCheckin[];
}
