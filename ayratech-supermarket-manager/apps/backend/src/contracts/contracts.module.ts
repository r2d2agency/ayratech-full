import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { Contract } from '../entities/contract.entity';
import { Client } from '../entities/client.entity';
import { ContractTemplate } from '../entities/contract-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, Client, ContractTemplate])],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
