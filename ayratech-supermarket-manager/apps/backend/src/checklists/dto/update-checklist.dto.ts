import { PartialType } from '@nestjs/mapped-types';
import { CreateChecklistTemplateDto } from './create-checklist.dto';

export class UpdateChecklistTemplateDto extends PartialType(CreateChecklistTemplateDto) {}
