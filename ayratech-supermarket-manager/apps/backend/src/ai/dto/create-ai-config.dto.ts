import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAiConfigDto {
  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
