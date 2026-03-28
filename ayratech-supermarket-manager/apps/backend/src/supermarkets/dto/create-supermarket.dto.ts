import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsUUID } from 'class-validator';

export class CreateSupermarketDto {
  @IsString()
  fantasyName: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsString()
  classification: string;
  
  // Address Fields
  @IsString()
  zipCode: string;

  @IsString()
  street: string;

  @IsString()
  number: string;

  @IsString()
  neighborhood: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clientIds?: string[];
}
