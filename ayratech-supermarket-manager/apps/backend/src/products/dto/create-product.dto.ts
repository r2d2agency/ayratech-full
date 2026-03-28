import { IsString, IsOptional, IsUUID, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  sku: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === '' ? null : value)
  categoryId?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsString()
  clientId: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === '' ? null : value)
  brandId?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  referenceImageUrl?: string;

  @IsOptional()
  @IsString()
  analysisPrompt?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value === '' ? null : value)
  checklistTemplateId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  supermarketGroupIds?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  supermarketIds?: string[];
}
