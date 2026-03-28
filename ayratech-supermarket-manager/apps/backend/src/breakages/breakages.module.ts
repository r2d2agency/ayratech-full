import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BreakagesService } from './breakages.service';
import { BreakagesController } from './breakages.controller';
import { BreakageReport } from './entities/breakage-report.entity';
import { RouteItem } from '../routes/entities/route-item.entity';
import { Product } from '../entities/product.entity';
import { Employee } from '../employees/entities/employee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BreakageReport, RouteItem, Product, Employee])],
  controllers: [BreakagesController],
  providers: [BreakagesService],
})
export class BreakagesModule {}
