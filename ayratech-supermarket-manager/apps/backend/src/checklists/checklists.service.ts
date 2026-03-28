import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistTemplate } from './entities/checklist-template.entity';
import { ChecklistTemplateItem } from './entities/checklist-template-item.entity';
import { CreateChecklistTemplateDto } from './dto/create-checklist.dto';
import { UpdateChecklistTemplateDto } from './dto/update-checklist.dto';

@Injectable()
export class ChecklistsService {
  constructor(
    @InjectRepository(ChecklistTemplate)
    private checklistRepository: Repository<ChecklistTemplate>,
    @InjectRepository(ChecklistTemplateItem)
    private checklistItemRepository: Repository<ChecklistTemplateItem>,
  ) {}

  async create(createDto: CreateChecklistTemplateDto) {
    const { items, ...templateData } = createDto;
    
    const template = this.checklistRepository.create(templateData);
    const savedTemplate = await this.checklistRepository.save(template);

    if (items && items.length > 0) {
      const itemEntities = items.map(item => 
        this.checklistItemRepository.create({
          ...item,
          competitors: item.competitorIds?.map(id => ({ id })),
          template: savedTemplate
        })
      );
      await this.checklistItemRepository.save(itemEntities);
    }

    return this.findOne(savedTemplate.id);
  }

  findAll() {
    return this.checklistRepository.find({
      order: {
        createdAt: 'DESC'
      }
    });
  }

  findOne(id: string) {
    return this.checklistRepository.findOne({
      where: { id },
      relations: ['items']
    });
  }

  async update(id: string, updateDto: UpdateChecklistTemplateDto) {
    const { items, ...templateData } = updateDto;
    
    if (Object.keys(templateData).length > 0) {
      await this.checklistRepository.update(id, templateData);
    }

    if (items) {
      // Simplest update strategy: Delete all existing items and recreate
      // This might not be ideal for history tracking but fits current scope
      await this.checklistItemRepository.delete({ templateId: id });
      
      const itemEntities = items.map(item => 
        this.checklistItemRepository.create({
          ...item,
          competitors: item.competitorIds?.map(id => ({ id })),
          templateId: id
        })
      );
      await this.checklistItemRepository.save(itemEntities);
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const result = await this.checklistRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Checklist Template with ID ${id} not found`);
    }
  }
}
