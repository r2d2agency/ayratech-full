import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeesPublicController } from './employees.public.controller';
import { Employee } from './entities/employee.entity';
import { EmployeeCompensation } from './entities/employee-compensation.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { WorkSchedule } from '../work-schedules/entities/work-schedule.entity';
import { WorkScheduleDay } from '../work-schedules/entities/work-schedule-day.entity';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AbsenceRequest } from '../absences/entities/absence-request.entity';
import { TimeClockModule } from '../time-clock/time-clock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, EmployeeCompensation, EmployeeDocument, WorkSchedule, WorkScheduleDay, AbsenceRequest]),
    UsersModule,
    RolesModule,
    NotificationsModule,
    TimeClockModule
  ],
  controllers: [EmployeesController, EmployeesPublicController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
