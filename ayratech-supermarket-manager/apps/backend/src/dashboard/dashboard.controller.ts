import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getStats(@Query('period') period: string, @Request() req) {
    return this.dashboardService.getStats(period, req.user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('aggregate')
  async getAggregate(@Query('period') period: string, @Request() req) {
    return this.dashboardService.getAggregate(period, req.user?.userId);
  }
}
