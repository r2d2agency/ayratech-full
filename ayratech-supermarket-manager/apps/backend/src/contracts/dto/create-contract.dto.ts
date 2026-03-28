import { IsString, IsDateString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class CreateContractDto {
  @IsString()
  description: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  value: number;

  @IsString()
  clientId: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  valuePerStore?: number;

  @IsOptional()
  @IsNumber()
  valuePerVisit?: number;

  @IsOptional()
  @IsString()
  visitFrequency?: string;

  @IsOptional()
  @IsNumber()
  visitsPerMonth?: number;

  @IsOptional()
  @IsNumber()
  slaPercentage?: number;

  @IsOptional()
  @IsString()
  content?: string;
}
