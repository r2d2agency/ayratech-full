import { Controller, Get, Delete, UseGuards, Query } from '@nestjs/common';
import { SystemLogsService } from './system-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('system-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SystemLogsController {
  constructor(private readonly logsService: SystemLogsService) {}

  @Get()
  findAll(@Query('limit') limit: number) {
    return this.logsService.findAll(limit || 100);
  }

  @Delete()
  clearLogs() {
    return this.logsService.clearLogs();
  }
}
