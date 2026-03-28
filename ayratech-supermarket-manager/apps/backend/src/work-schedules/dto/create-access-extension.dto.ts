import { IsUUID, IsDateString, IsString, IsOptional, Matches } from 'class-validator';

export class CreateAccessExtensionDto {
  @IsUUID()
  employeeId: string;

  @IsDateString()
  date: string; // YYYY-MM-DD

  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Time must be in HH:MM format' })
  extendedEndTime: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
