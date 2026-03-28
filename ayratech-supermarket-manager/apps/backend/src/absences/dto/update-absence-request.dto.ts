import { PartialType } from '@nestjs/mapped-types';
import { CreateAbsenceRequestDto } from './create-absence-request.dto';
import { IsString, IsOptional } from 'class-validator';

export class UpdateAbsenceRequestDto extends PartialType(CreateAbsenceRequestDto) {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  approverId?: string;

  @IsString()
  @IsOptional()
  approvedAt?: string;
}
