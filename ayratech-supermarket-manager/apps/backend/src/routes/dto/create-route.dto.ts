import { IsString, IsDateString, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class RouteItemProductDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  checklistTemplateId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  checklistTypes?: string[];

  @IsOptional()
  @IsBoolean()
  requiresStockPhotos?: boolean;
}

class RouteItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  supermarketId: string;

  @IsOptional()
  order: number;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  estimatedDuration?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteItemProductDto)
  products?: RouteItemProductDto[];
}

export class CreateRouteDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  promoterId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  promoterIds?: string[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  checklistTemplateId?: string;

  @IsOptional()
  isTemplate?: boolean;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsString()
  recurrenceGroup?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteItemDto)
  items: RouteItemDto[];
}
