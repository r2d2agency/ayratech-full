import { PartialType } from '@nestjs/mapped-types';
import { CreateSupermarketGroupDto } from './create-supermarket-group.dto';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateSupermarketGroupDto extends PartialType(CreateSupermarketGroupDto) {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}
