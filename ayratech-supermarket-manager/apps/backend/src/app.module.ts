import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule } from './clients/clients.module';
import { ProductsModule } from './products/products.module';
import { SupermarketsModule } from './supermarkets/supermarkets.module';
import { SupermarketGroupsModule } from './supermarket-groups/supermarket-groups.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContractsModule } from './contracts/contracts.module';
import { RoutesModule } from './routes/routes.module';
import { ContractTemplatesModule } from './contract-templates/contract-templates.module';
import { RolesModule } from './roles/roles.module';
import { BrandsModule } from './brands/brands.module';
import { EmployeesModule } from './employees/employees.module';
import { WorkSchedulesModule } from './work-schedules/work-schedules.module';
import { TimeClockModule } from './time-clock/time-clock.module';
import { AbsencesModule } from './absences/absences.module';
import { UploadModule } from './upload/upload.module';
import { CategoriesModule } from './categories/categories.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AppSyncModule } from './app-sync/app-sync.module';
import { ImageAnalysisModule } from './integrations/image-analysis/image-analysis.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagesModule } from './messages/messages.module';
import { SystemLogsModule } from './system-logs/system-logs.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { BreakagesModule } from './breakages/breakages.module';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

import { AiModule } from './ai/ai.module';
import { CompetitorsModule } from './competitors/competitors.module';
import { SettingsModule } from './settings/settings.module';
import { IncidentReasonsModule } from './incident-reasons/incident-reasons.module';
import { UPLOAD_ROOT } from './config/upload.config';
import { ProductIncidentsModule } from './product-incidents/product-incidents.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbConfig: any = {
          type: 'postgres',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'password'),
          database: configService.get<string>('DB_DATABASE', 'ayratech_db'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
          autoLoadEntities: true,
        };

        const databaseUrl = configService.get<string>('DATABASE_URL');
        if (databaseUrl) {
          dbConfig.url = databaseUrl;
        }

        if (configService.get<string>('DB_SSL') === 'true') {
          dbConfig.ssl = { rejectUnauthorized: false };
        }

        console.log('DB Config:', { ...dbConfig, password: '***', url: dbConfig.url ? '***' : undefined });
        return dbConfig;
      },
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: UPLOAD_ROOT,
      serveRoot: '/uploads',
    }),
    ClientsModule,
    ProductsModule,
    SupermarketsModule,
    SupermarketGroupsModule,
    AuthModule,
    UsersModule,
    ContractsModule,
    RoutesModule,
    ContractTemplatesModule,
    BrandsModule,
    RolesModule,
    EmployeesModule,
    WorkSchedulesModule,
    TimeClockModule,
    AbsencesModule,
    UploadModule,
    CategoriesModule,
    DashboardModule,
    AppSyncModule,
    ImageAnalysisModule,
    NotificationsModule,
    MessagesModule,
    SystemLogsModule,
    ChecklistsModule,
    AiModule,
    CompetitorsModule,
    SettingsModule,
    BreakagesModule,
    IncidentReasonsModule,
    ProductIncidentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
