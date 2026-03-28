import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Setting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'Ayratech' })
  companyName: string;

  @Column({ default: '#196ee6' })
  primaryColor: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  loginLogoUrl: string;

  @Column({ nullable: true })
  systemLogoUrl: string;

  @Column({ nullable: true })
  splashScreenUrl: string;

  @Column({ nullable: true })
  faviconUrl: string;

  @Column({ nullable: true })
  pwaIconUrl: string;

  @Column({ nullable: true })
  siteIconUrl: string;

  @Column({ default: 8 })
  blurThreshold: number;
}