import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from '../entities/brand.entity';
import { Client } from '../entities/client.entity';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { BrandAvailabilityWindow } from './entities/brand-availability-window.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Supermarket } from '../entities/supermarket.entity';
import { Product } from '../entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Brand, Client, BrandAvailabilityWindow, Employee, Supermarket, Product])],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
