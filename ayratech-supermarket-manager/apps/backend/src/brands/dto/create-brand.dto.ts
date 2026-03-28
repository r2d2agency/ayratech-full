import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BrandAvailabilityWindowDto {
  @IsInt()
  dayOfWeek: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;
}

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  clientId: string;

  @IsBoolean()
  @IsOptional()
  waitForStockCount?: boolean;

  @IsString()
  @IsOptional()
  stockNotificationContact?: string;

  @IsString()
  @IsOptional()
  inventoryFrequency?: string;

  @IsInt()
  @IsOptional()
  inventoryFrequencyDays?: number;

  @IsBoolean()
  @IsOptional()
  inventoryPostponeUntilWeekEnd?: boolean;

  @IsBoolean()
  @IsOptional()
  inventoryPostponeRequiresJustification?: boolean;

  @IsInt()
  @IsOptional()
  inventoryMaxPostponesPerWeek?: number;

  @IsString()
  @IsOptional()
  @IsUUID()
  checklistTemplateId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  promoterIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supermarketIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrandAvailabilityWindowDto)
  availabilityWindows?: BrandAvailabilityWindowDto[];
}
