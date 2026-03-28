import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentReasonsController } from './incident-reasons.controller';
import { IncidentReasonsService } from './incident-reasons.service';
import { IncidentReason } from './entities/incident-reason.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IncidentReason])],
  controllers: [IncidentReasonsController],
  providers: [IncidentReasonsService],
})
export class IncidentReasonsModule {}
