import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IncidentReasonType } from '../entities/incident-reason.entity';

export class CreateIncidentReasonDto {
  @IsEnum(IncidentReasonType)
  type: IncidentReasonType;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
