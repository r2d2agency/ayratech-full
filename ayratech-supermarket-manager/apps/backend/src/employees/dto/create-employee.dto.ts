import { IsNotEmpty, IsString, IsOptional, IsEmail, IsDateString, IsNumber, Validate, Allow } from 'class-validator';
import { Type } from 'class-transformer';
import { IsCPFConstraint } from '../../utils/validators/cpf.validator';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @Validate(IsCPFConstraint)
  cpf: string;

  @IsOptional()
  @IsString()
  rg?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: Date;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  addressStreet: string;

  @IsString()
  @IsNotEmpty()
  addressNumber: string;

  @IsString()
  @IsNotEmpty()
  addressDistrict: string;

  @IsString()
  @IsNotEmpty()
  addressCity: string;

  @IsString()
  @IsNotEmpty()
  addressState: string;

  @IsString()
  @IsNotEmpty()
  addressZip: string;

  @IsString()
  @IsNotEmpty()
  internalCode: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  supervisorId?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsString()
  @IsNotEmpty()
  contractType: string;

  @IsDateString()
  @IsNotEmpty()
  admissionDate: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsOptional()
  @IsString()
  facialPhotoUrl?: string;

  // Optional initial compensation
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
  createAccess?: string | boolean; // Can be string (FormData) or boolean (JSON)

  @IsOptional()
  @IsString()
  appPassword?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  weeklyHours?: number;
}
