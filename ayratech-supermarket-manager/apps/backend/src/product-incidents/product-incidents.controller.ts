import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateProductIncidentDto } from './dto/create-product-incident.dto';
import { ProductIncidentsService } from './product-incidents.service';

@Controller('product-incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductIncidentsController {
  constructor(private readonly productIncidentsService: ProductIncidentsService) {}

  @Post()
  @Roles('promoter', 'promotor', 'supervisor', 'admin', 'administrador', 'user')
  create(@Body() dto: CreateProductIncidentDto, @Req() req: any) {
    const promoterId = req.user?.employee?.id;
    return this.productIncidentsService.create(dto, promoterId);
  }

  @Get()
  @Roles('promoter', 'promotor', 'supervisor', 'admin', 'administrador', 'user', 'client')
  findAll(@Query() query: any, @Req() req: any) {
    return this.productIncidentsService.findAll(query, req.user);
  }
}
