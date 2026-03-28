import { Module } from '@nestjs/common';
import { AppSyncController } from './app-sync.controller';
import { AppSyncService } from './app-sync.service';
import { TimeClockModule } from '../time-clock/time-clock.module';
import { EmployeesModule } from '../employees/employees.module';
import { RoutesModule } from '../routes/routes.module';
import { ImageAnalysisModule } from '../integrations/image-analysis/image-analysis.module';
import { SupermarketsModule } from '../supermarkets/supermarkets.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TimeClockModule,
    EmployeesModule,
    RoutesModule,
    ImageAnalysisModule,
    SupermarketsModule,
    UsersModule
  ],
  controllers: [AppSyncController],
  providers: [AppSyncService],
})
export class AppSyncModule {}
