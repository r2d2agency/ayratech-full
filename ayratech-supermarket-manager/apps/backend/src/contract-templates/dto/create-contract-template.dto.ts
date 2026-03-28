import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateContractTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  originalFileName?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
