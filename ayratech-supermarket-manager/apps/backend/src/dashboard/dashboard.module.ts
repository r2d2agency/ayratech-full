import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Route } from '../routes/entities/route.entity';
import { Client } from '../entities/client.entity';
import { RouteItemProduct } from '../routes/entities/route-item-product.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Route, Client, RouteItemProduct, User])
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
