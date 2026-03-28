import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeDto } from './create-employee.dto';
import { IsOptional, IsNumber, Allow } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  baseSalary?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  hourlyRate?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  dailyRate?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  visitRate?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  monthlyAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  transportVoucher?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  mealVoucher?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  chargesPercentage?: number;

  @IsOptional()
  @Allow()
  createAccess?: string | boolean;
}
