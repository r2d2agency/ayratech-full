import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, IsUUID, Min } from 'class-validator';

export class CreateBreakageDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsUUID()
  @IsOptional()
  routeItemId: string;

  @IsUUID()
  @IsOptional()
  supermarketId: string;

  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos: string[];

  @IsString()
  @IsOptional()
  description?: string;
}
