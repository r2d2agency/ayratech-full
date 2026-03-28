import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ChecklistItemType } from '../entities/checklist-template-item.entity';

export class CreateChecklistItemDto {
  @IsString()
  description: string;

  @IsEnum(ChecklistItemType)
  type: ChecklistItemType;

  @IsBoolean()
  isMandatory: boolean;

  @IsNumber()
  order: number;

  @IsOptional()
  @IsString()
  competitorId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competitorIds?: string[];
}

export class CreateChecklistTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistItemDto)
  items: CreateChecklistItemDto[];
}
