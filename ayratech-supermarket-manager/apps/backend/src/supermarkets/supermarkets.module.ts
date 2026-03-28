import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupermarketsService } from './supermarkets.service';
import { SupermarketsController } from './supermarkets.controller';
import { Supermarket } from '../entities/supermarket.entity';
import { SupermarketGroup } from '../supermarket-groups/entities/supermarket-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Supermarket, SupermarketGroup])],
  controllers: [SupermarketsController],
  providers: [SupermarketsService],
  exports: [SupermarketsService],
})
export class SupermarketsModule {}
