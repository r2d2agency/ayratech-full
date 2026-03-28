import { PartialType } from '@nestjs/mapped-types';
import { CreateSupermarketDto } from './create-supermarket.dto';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateSupermarketDto extends PartialType(CreateSupermarketDto) {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clientIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}
