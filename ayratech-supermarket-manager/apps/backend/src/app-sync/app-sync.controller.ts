import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AppSyncService } from './app-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('app/sync')
@UseGuards(JwtAuthGuard)
export class AppSyncController {
  constructor(private readonly appSyncService: AppSyncService) {}

  @Post('push')
  async pushData(@Body() data: any, @Request() req) {
    const user = req.user;
    // User contains email, id, etc. logic to find employeeId
    return this.appSyncService.processOfflineActions(user.userId, data);
  }

  @Get('pull')
  async pullData(@Query('lastSync') lastSync: string, @Request() req) {
    const user = req.user;
    return this.appSyncService.fetchUpdates(user.userId, lastSync);
  }
}
