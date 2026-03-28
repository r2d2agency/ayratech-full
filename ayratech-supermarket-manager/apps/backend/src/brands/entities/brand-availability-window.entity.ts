import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Brand } from '../../entities/brand.entity';

@Entity('brand_availability_windows')
export class BrandAvailabilityWindow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  brandId: string;

  @ManyToOne(() => Brand, (brand) => brand.availabilityWindows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brandId' })
  brand: Brand;

  @Column({ type: 'int' })
  dayOfWeek: number;

  @Column({ default: true })
  active: boolean;

  @Column()
  startTime: string;

  @Column()
  endTime: string;
}
