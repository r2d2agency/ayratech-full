import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ProductIncidentLocation, ProductIncidentType } from '../entities/product-incident.entity';

export class CreateProductIncidentDto {
  @IsEnum(ProductIncidentType)
  type: ProductIncidentType;

  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  routeItemId?: string;

  @IsOptional()
  @IsUUID()
  supermarketId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  validityDate?: string;

  @IsOptional()
  @IsEnum(ProductIncidentLocation)
  location?: ProductIncidentLocation;

  @IsOptional()
  @IsUUID()
  reasonId?: string;

  @IsOptional()
  @IsString()
  reasonLabel?: string;

  @IsString()
  description: string;
}
