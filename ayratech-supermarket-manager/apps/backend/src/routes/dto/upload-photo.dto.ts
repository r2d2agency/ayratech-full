import { IsString, IsOptional } from 'class-validator';

export class UploadPhotoDto {
  @IsString()
  type: string;

  @IsString()
  @IsOptional()
  category?: string;
}
