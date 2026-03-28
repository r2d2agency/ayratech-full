import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BreakageReport, BreakageStatus } from './entities/breakage-report.entity';
import { CreateBreakageDto } from './dto/create-breakage.dto';
import { UpdateBreakageDto } from './dto/update-breakage.dto';
import { RouteItem } from '../routes/entities/route-item.entity';

@Injectable()
export class BreakagesService {
  constructor(
    @InjectRepository(BreakageReport)
    private breakageRepository: Repository<BreakageReport>,
    @InjectRepository(RouteItem)
    private routeItemRepository: Repository<RouteItem>,
  ) {}

  async create(userId: string, createBreakageDto: CreateBreakageDto) {
    try {
      console.log('Creating Breakage Report:', { userId, ...createBreakageDto });
      
      const breakage = this.breakageRepository.create({
        ...createBreakageDto,
        promoterId: userId,
      });

      // Se tiver routeItemId, tentar pegar o supermarketId dele se não vier no DTO
      if (createBreakageDto.routeItemId && !createBreakageDto.supermarketId) {
        const routeItem = await this.routeItemRepository.findOne({
          where: { id: createBreakageDto.routeItemId },
          relations: ['supermarket'],
        });
        if (routeItem?.supermarket) {
          breakage.supermarketId = routeItem.supermarket.id;
        }
      }

      const saved = await this.breakageRepository.save(breakage);
      console.log('Breakage saved:', saved.id);
      return saved;
    } catch (error) {
      console.error('Error creating breakage report:', error);
      throw error;
    }
  }

  async findAll(query: any, user: any) {
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    // Se for promotor, só vê os seus
    if (user.role === 'promoter' || user.role === 'promotor') {
      where.promoterId = user.employee?.id || user.userId;
    } else if (query.promoterId) {
      // Admin pode filtrar por promotor
      where.promoterId = query.promoterId;
    }

    if (query.supermarketId) {
      where.supermarketId = query.supermarketId;
    }
    
    // Filtro por data (opcional)
    // ...

    return this.breakageRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['product', 'supermarket', 'promoter'],
    });
  }

  async findOne(id: string) {
    const breakage = await this.breakageRepository.findOne({ where: { id } });
    if (!breakage) throw new NotFoundException('Avaria não encontrada');
    return breakage;
  }

  async updateInvoice(ids: string[], invoiceData: UpdateBreakageDto) {
    if (!ids || ids.length === 0) return;

    await this.breakageRepository.update(
      { id: In(ids) },
      {
        ...invoiceData,
        status: BreakageStatus.COMPLETED,
      },
    );

    return this.breakageRepository.find({ where: { id: In(ids) } });
  }
}
