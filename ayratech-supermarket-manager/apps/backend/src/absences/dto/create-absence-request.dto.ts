import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateAbsenceRequestDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsOptional()
  approverId?: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  startDate: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  medicalCid?: string;

  @IsString()
  @IsOptional()
  medicalProfessionalName?: string;

  @IsString()
  @IsOptional()
  medicalServiceLocation?: string;

  @IsString()
  @IsOptional()
  medicalLicenseType?: string;

  @IsString()
  @IsOptional()
  medicalLicenseNumber?: string;

  @IsString()
  @IsOptional()
  employeeDocumentId?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
