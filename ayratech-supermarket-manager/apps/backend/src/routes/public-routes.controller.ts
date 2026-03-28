import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { RoutesService } from './routes.service';

@Controller('public/routes')
export class PublicRoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('validate-stock/:token')
  getValidationInfo(@Param('token') token: string) {
    return this.routesService.getPublicStockValidation(token);
  }

  @Post('validate-stock/:token')
  processValidation(
    @Param('token') token: string,
    @Body() body: { action: 'APPROVE' | 'REJECT'; observation?: string },
  ) {
    return this.routesService.processPublicStockValidation(token, body.action, body.observation);
  }
}
