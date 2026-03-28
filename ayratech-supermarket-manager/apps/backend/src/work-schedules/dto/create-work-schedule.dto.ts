import { IsNotEmpty, IsString, IsDateString, IsNumber, IsArray, ValidateNested, IsBoolean, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkScheduleDayDto {
  @IsNumber()
  @IsNotEmpty()
  dayOfWeek: number;

  @IsBoolean()
  @IsNotEmpty()
  active: boolean;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @IsString()
  breakStart?: string;

  @IsOptional()
  @IsString()
  breakEnd?: string;

  @IsOptional()
  @IsNumber()
  toleranceMinutes?: number;
}

export class CreateWorkScheduleDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsDateString()
  @IsNotEmpty()
  validFrom: Date;

  @IsOptional()
  @IsDateString()
  validTo?: Date;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsNumber()
  weeklyHours?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkScheduleDayDto)
  days: CreateWorkScheduleDayDto[];
}

export class CreateWorkScheduleExceptionDto {
  employeeId: string;
  date: Date;
  type: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
}
