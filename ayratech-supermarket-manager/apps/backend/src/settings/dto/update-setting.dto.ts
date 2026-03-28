import { IsString, IsOptional, IsHexColor } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  loginLogoUrl?: string;

  @IsString()
  @IsOptional()
  systemLogoUrl?: string;

  @IsString()
  @IsOptional()
  splashScreenUrl?: string;

  @IsString()
  @IsOptional()
  faviconUrl?: string;

  @IsString()
  @IsOptional()
  pwaIconUrl?: string;

  @IsString()
  @IsOptional()
  siteIconUrl?: string;

  @IsOptional()
  blurThreshold?: number;
}