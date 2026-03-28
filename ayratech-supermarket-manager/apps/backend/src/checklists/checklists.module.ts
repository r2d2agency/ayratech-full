import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistsService } from './checklists.service';
import { ChecklistsController } from './checklists.controller';
import { ChecklistTemplate } from './entities/checklist-template.entity';
import { ChecklistTemplateItem } from './entities/checklist-template-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChecklistTemplate, ChecklistTemplateItem])],
  controllers: [ChecklistsController],
  providers: [ChecklistsService],
  exports: [ChecklistsService]
})
export class ChecklistsModule {}
