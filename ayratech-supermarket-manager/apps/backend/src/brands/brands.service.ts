import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Brand } from '../entities/brand.entity';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Client } from '../entities/client.entity';
import { BrandAvailabilityWindow } from './entities/brand-availability-window.entity';
import { Product } from '../entities/product.entity';
import { Supermarket } from '../entities/supermarket.entity';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private brandsRepository: Repository<Brand>,
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
    @InjectRepository(BrandAvailabilityWindow)
    private brandAvailabilityRepository: Repository<BrandAvailabilityWindow>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Supermarket)
    private supermarketsRepository: Repository<Supermarket>,
  ) {}

  async create(createBrandDto: CreateBrandDto) {
    const { clientId, promoterIds, supermarketIds, availabilityWindows, ...brandData } = createBrandDto as any;
    if (!clientId) {
      throw new BadRequestException('clientId é obrigatório');
    }
    const client = await this.clientsRepository.findOne({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    const brand = this.brandsRepository.create({
      ...brandData,
      client,
      promoters: Array.isArray(promoterIds) ? promoterIds.map((id: string) => ({ id } as any)) : undefined,
      supermarkets: Array.isArray(supermarketIds) ? supermarketIds.map((id: string) => ({ id } as any)) : undefined,
    } as DeepPartial<Brand>);

    try {
      const saved: Brand = await this.brandsRepository.save(brand);

      if (Array.isArray(availabilityWindows)) {
        await this.brandAvailabilityRepository.delete({ brandId: saved.id } as any);
        const windows = availabilityWindows.map((w: any) =>
          this.brandAvailabilityRepository.create({
            brandId: saved.id,
            dayOfWeek: Number(w.dayOfWeek),
            active: w.active !== false,
            startTime: String(w.startTime),
            endTime: String(w.endTime),
          }),
        );
        if (windows.length > 0) {
          await this.brandAvailabilityRepository.save(windows);
        }
      }

      return this.findOne(saved.id);
    } catch (err) {
      throw new BadRequestException(err.message || 'Erro ao criar marca');
    }
  }

  findAll() {
    return this.brandsRepository.find({
      relations: ['client', 'products', 'checklistTemplate', 'availabilityWindows', 'promoters', 'supermarkets'],
    });
  }

  findOne(id: string) {
    return this.brandsRepository.findOne({ 
      where: { id },
      relations: ['client', 'products', 'checklistTemplate', 'availabilityWindows', 'promoters', 'supermarkets']
    });
  }

  async update(id: string, updateBrandDto: UpdateBrandDto) {
    const { clientId, promoterIds, supermarketIds, availabilityWindows, ...brandData } = updateBrandDto as any;
    
    try {
      const brand = await this.brandsRepository.findOne({
        where: { id },
        relations: ['promoters', 'supermarkets', 'availabilityWindows'],
      });
      if (!brand) throw new NotFoundException('Marca não encontrada');

      // 1. If there are simple fields to update, update them
      if (Object.keys(brandData).length > 0) {
        await this.brandsRepository.update(id, brandData);
        Object.assign(brand, brandData);
      }

      // 2. If there is a clientId change, update the relation specifically
      if (clientId) {
        const client = await this.clientsRepository.findOne({ where: { id: clientId } });
        if (!client) {
          throw new BadRequestException('Cliente não encontrado');
        }
        
        // Use Raw Query to update the relation column directly
        // This bypasses TypeORM's object dirty checking AND the update: false restriction on the column
        // Using metadata.tableName ensures we use the correct table name
        await this.brandsRepository.query(
            `UPDATE "${this.brandsRepository.metadata.tableName}" SET "clientId" = $1 WHERE id = $2`,
            [clientId, id]
        );
      }

      if (Array.isArray(promoterIds)) {
        brand.promoters = promoterIds.map((pid: string) => ({ id: pid } as any));
        await this.brandsRepository.save(brand);
      }

      if (Array.isArray(supermarketIds)) {
        brand.supermarkets = supermarketIds.map((sid: string) => ({ id: sid } as any));
        await this.brandsRepository.save(brand);
      }

      if (Array.isArray(availabilityWindows)) {
        await this.brandAvailabilityRepository.delete({ brandId: id } as any);
        const windows = availabilityWindows.map((w: any) =>
          this.brandAvailabilityRepository.create({
            brandId: id,
            dayOfWeek: Number(w.dayOfWeek),
            active: w.active !== false,
            startTime: String(w.startTime),
            endTime: String(w.endTime),
          }),
        );
        if (windows.length > 0) {
          await this.brandAvailabilityRepository.save(windows);
        }
      }

      // 3. Return the updated entity
      return this.findOne(id);
    } catch (err) {
      console.error(`Error updating brand ${id}:`, err);
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      if (err.code === '23503') {
        throw new BadRequestException('Cliente inválido ou não encontrado');
      }
      // Log detailed error for debugging schema mismatches
      if (err.code === '42703') { // Undefined column
         console.error('Database schema mismatch: Column not found. Ensure migrations have run.');
      }
      throw new BadRequestException(err.message || 'Erro ao atualizar marca');
    }
  }

  remove(id: string) {
    return this.brandsRepository.findOne({ where: { id }, relations: ['products'] }).then(existing => {
      if (!existing) throw new NotFoundException('Marca não encontrada');
      if (existing.products && existing.products.length > 0) {
        throw new BadRequestException('Não é possível excluir uma marca que possui produtos associados. Remova ou reassocie os produtos primeiro.');
      }
      return this.brandsRepository.delete(id);
    }).catch(err => {
      throw new BadRequestException(err.message || 'Erro ao excluir marca');
    });
  }

  async getSchedulingContext(brandId: string, supermarketId?: string) {
    const brand = await this.brandsRepository.findOne({
      where: { id: brandId },
      relations: ['client', 'checklistTemplate', 'availabilityWindows', 'promoters', 'supermarkets'],
    });
    if (!brand) throw new NotFoundException('Marca não encontrada');

    let products: any[] = [];
    if (supermarketId) {
      const supermarket = await this.supermarketsRepository.findOne({
        where: { id: supermarketId },
        relations: ['group'],
      });
      if (!supermarket) throw new BadRequestException('PDV não encontrado');

      const groupId = (supermarket as any).group?.id || null;

      const allBrandProducts = await this.productsRepository.find({
        where: { brandId },
        relations: ['supermarketGroups', 'brand', 'client', 'categoryRef', 'categoryRef.parent', 'checklistTemplate'],
      });

      products = allBrandProducts.filter(p => {
        const groups = (p as any).supermarketGroups || [];
        if (!Array.isArray(groups) || groups.length === 0) return true;
        if (!groupId) return false;
        return groups.some((g: any) => g.id === groupId);
      });
    }

    return {
      brand,
      products,
    };
  }
}
