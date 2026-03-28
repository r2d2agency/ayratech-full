import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupermarketGroupsService } from './supermarket-groups.service';
import { SupermarketGroupsController } from './supermarket-groups.controller';
import { SupermarketGroup } from './entities/supermarket-group.entity';
import { Product } from '../entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SupermarketGroup, Product])],
  controllers: [SupermarketGroupsController],
  providers: [SupermarketGroupsService],
  exports: [SupermarketGroupsService],
})
export class SupermarketGroupsModule {}
