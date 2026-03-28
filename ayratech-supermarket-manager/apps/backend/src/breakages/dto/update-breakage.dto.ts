import { IsNotEmpty, IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { BreakageStatus } from '../entities/breakage-report.entity';

export class UpdateBreakageDto {
  @IsEnum(BreakageStatus)
  @IsOptional()
  status?: BreakageStatus;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsDateString()
  @IsOptional()
  invoiceDate?: string;

  @IsString()
  @IsOptional()
  invoicePhoto?: string;
}
