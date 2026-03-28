import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeClockService } from './time-clock.service';
import { TimeClockController } from './time-clock.controller';
import { TimeClockEvent } from './entities/time-clock-event.entity';
import { TimeBalance } from './entities/time-balance.entity';
import { TimeBalanceAdjustment } from './entities/time-balance-adjustment.entity';
import { Employee } from '../employees/entities/employee.entity';
import { WorkSchedule } from '../work-schedules/entities/work-schedule.entity';
import { TimeClockGateway } from './time-clock.gateway';
import { TimeClockMonitorService } from './time-clock-monitor.service';
import { AbsencesModule } from '../absences/absences.module';
import { AbsenceRequest } from '../absences/entities/absence-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeClockEvent, TimeBalance, TimeBalanceAdjustment, Employee, WorkSchedule, AbsenceRequest]),
    AbsencesModule,
  ],
  controllers: [TimeClockController],
  providers: [TimeClockService, TimeClockGateway, TimeClockMonitorService],
  exports: [TimeClockService],
})
export class TimeClockModule {}
