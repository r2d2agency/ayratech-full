import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { Product } from './product.entity';
import { Brand } from './brand.entity';
import { Supermarket } from './supermarket.entity';
import { User } from '../users/entities/user.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'razao_social' })
  razaoSocial: string;

  @Column({ name: 'nome_fantasia', nullable: true })
  nomeFantasia: string;

  @Column({ nullable: true })
  cnpj: string;

  @Column({ name: 'email_principal', nullable: true })
  emailPrincipal: string;

  @Column({ name: 'telefone_principal', nullable: true })
  telefonePrincipal: string;

  @Column({ default: 'ativo' })
  status: string;

  @Column({ nullable: true })
  logradouro: string;

  @Column({ nullable: true })
  numero: string;

  @Column({ nullable: true })
  bairro: string;

  @Column({ nullable: true })
  cidade: string;

  @Column({ nullable: true })
  estado: string;

  @Column({ nullable: true })
  cep: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ type: 'simple-json', nullable: true })
  photoConfig: {
    labels?: {
      before?: string;
      storage?: string;
      after?: string;
    };
    categories?: Record<string, {
      labels?: {
        before?: string;
        storage?: string;
        after?: string;
      }
    }>;
  };

  @Column({ nullable: true })
  defaultVisitChecklistTemplateId: string;

  @Column({ nullable: true })
  defaultInventoryChecklistTemplateId: string;

  @Column({ default: true })
  requiresInventoryCount: boolean;

  @Column({ default: 500 })
  locationRange: number;

  @Column({ nullable: true })
  inventoryFrequency: string; // 'daily', 'weekly', 'biweekly', 'monthly'

  @Column({ nullable: true, select: false })
  password: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Brand, (brand) => brand.client)
  brands: Brand[];

  @OneToMany(() => Product, (product) => product.client)
  products: Product[];

  @ManyToMany(() => Supermarket, (supermarket) => supermarket.clients)
  @JoinTable({ name: 'client_supermarkets' })
  supermarkets: Supermarket[];

  @ManyToMany(() => User, (user) => user.clients)
  supervisors: User[];
}
