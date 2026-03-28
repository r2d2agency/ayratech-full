import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAiPromptDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  supportsImageAnalysis?: boolean;
}
