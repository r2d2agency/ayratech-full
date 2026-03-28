import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Competitor } from './entities/competitor.entity';
import { CreateCompetitorDto } from './dto/create-competitor.dto';
import { UpdateCompetitorDto } from './dto/update-competitor.dto';

@Injectable()
export class CompetitorsService {
  constructor(
    @InjectRepository(Competitor)
    private competitorsRepository: Repository<Competitor>,
  ) {}

  create(createCompetitorDto: CreateCompetitorDto) {
    const competitor = this.competitorsRepository.create(createCompetitorDto);
    return this.competitorsRepository.save(competitor);
  }

  findAll() {
    return this.competitorsRepository.find({ order: { name: 'ASC' } });
  }

  findOne(id: string) {
    return this.competitorsRepository.findOne({ where: { id } });
  }

  async update(id: string, updateCompetitorDto: UpdateCompetitorDto) {
    if (Object.keys(updateCompetitorDto).length > 0) {
      await this.competitorsRepository.update(id, updateCompetitorDto);
    }
    return this.findOne(id);
  }

  remove(id: string) {
    return this.competitorsRepository.delete(id);
  }
}
