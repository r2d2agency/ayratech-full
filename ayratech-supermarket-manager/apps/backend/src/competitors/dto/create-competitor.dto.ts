import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateCompetitorDto {
  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
