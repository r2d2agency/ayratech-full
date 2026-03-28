import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { CreateProductIncidentDto } from './dto/create-product-incident.dto';
import { ProductIncident } from './entities/product-incident.entity';

@Injectable()
export class ProductIncidentsService {
  constructor(
    @InjectRepository(ProductIncident)
    private productIncidentsRepository: Repository<ProductIncident>,
    @InjectRepository(Employee)
    private employeesRepository: Repository<Employee>,
  ) {}

  async create(dto: CreateProductIncidentDto, promoterId: string) {
    if (!promoterId) throw new BadRequestException('Promoter ID não encontrado');

    const promoter = await this.employeesRepository.findOne({ where: { id: promoterId } });
    if (!promoter) throw new BadRequestException('Promotor inválido');

    const incident = this.productIncidentsRepository.create({
      ...dto,
      promoterId,
      promoter: { id: promoterId } as any,
      product: { id: dto.productId } as any,
      routeItem: dto.routeItemId ? ({ id: dto.routeItemId } as any) : null,
      supermarket: dto.supermarketId ? ({ id: dto.supermarketId } as any) : null,
    });

    return this.productIncidentsRepository.save(incident);
  }

  async findAll(query: { type?: string; routeItemId?: string; supermarketId?: string; productId?: string }, user: any) {
    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.routeItemId) where.routeItemId = query.routeItemId;
    if (query.supermarketId) where.supermarketId = query.supermarketId;
    if (query.productId) where.productId = query.productId;

    const role = String(user?.role || '').toLowerCase();
    const isPromoter = role === 'promoter' || role === 'promotor';
    if (isPromoter) {
      const promoterId = user?.employee?.id || user?.employeeId || user?.userId || user?.id || user?.sub;
      where.promoterId = promoterId;
    }

    return this.productIncidentsRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 500,
    });
  }
}
