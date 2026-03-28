import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { ProductIncident } from './entities/product-incident.entity';
import { ProductIncidentsController } from './product-incidents.controller';
import { ProductIncidentsService } from './product-incidents.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductIncident, Employee])],
  controllers: [ProductIncidentsController],
  providers: [ProductIncidentsService],
})
export class ProductIncidentsModule {}
