import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateIncidentReasonDto } from './dto/create-incident-reason.dto';
import { UpdateIncidentReasonDto } from './dto/update-incident-reason.dto';
import { IncidentReason, IncidentReasonType } from './entities/incident-reason.entity';

@Injectable()
export class IncidentReasonsService {
  constructor(
    @InjectRepository(IncidentReason)
    private incidentReasonsRepository: Repository<IncidentReason>,
  ) {}

  create(dto: CreateIncidentReasonDto) {
    const reason = this.incidentReasonsRepository.create({
      type: dto.type,
      label: dto.label,
      isActive: dto.isActive ?? true,
    });
    return this.incidentReasonsRepository.save(reason);
  }

  findAll(query: { type?: string; all?: string }, user: any) {
    const where: any = {};

    if (query.type) where.type = query.type as IncidentReasonType;

    const isPromoter = user?.role === 'promoter' || user?.role === 'promotor';
    const wantsAll = query.all === 'true';

    if (isPromoter || !wantsAll) where.isActive = true;

    return this.incidentReasonsRepository.find({
      where,
      order: { label: 'ASC' },
    });
  }

  async update(id: string, dto: UpdateIncidentReasonDto) {
    const existing = await this.incidentReasonsRepository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Motivo não encontrado');

    const updated = this.incidentReasonsRepository.merge(existing, dto as any);
    return this.incidentReasonsRepository.save(updated);
  }

  async remove(id: string) {
    const existing = await this.incidentReasonsRepository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Motivo não encontrado');
    await this.incidentReasonsRepository.remove(existing);
    return { success: true };
  }
}
