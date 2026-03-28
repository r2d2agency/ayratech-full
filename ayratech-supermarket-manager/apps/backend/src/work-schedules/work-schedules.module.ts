import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkSchedulesService } from './work-schedules.service';
import { WorkSchedulesController } from './work-schedules.controller';
import { WorkSchedule } from './entities/work-schedule.entity';
import { WorkScheduleDay } from './entities/work-schedule-day.entity';
import { WorkScheduleException } from './entities/work-schedule-exception.entity';
import { AccessExtension } from './entities/access-extension.entity';
import { Employee } from '../employees/entities/employee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkSchedule, WorkScheduleDay, WorkScheduleException, AccessExtension, Employee])],
  controllers: [WorkSchedulesController],
  providers: [WorkSchedulesService],
  exports: [WorkSchedulesService],
})
export class WorkSchedulesModule {}
