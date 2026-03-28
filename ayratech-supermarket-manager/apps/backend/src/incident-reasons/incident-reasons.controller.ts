import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateIncidentReasonDto } from './dto/create-incident-reason.dto';
import { UpdateIncidentReasonDto } from './dto/update-incident-reason.dto';
import { IncidentReasonsService } from './incident-reasons.service';

@Controller('incident-reasons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentReasonsController {
  constructor(private readonly incidentReasonsService: IncidentReasonsService) {}

  @Get()
  @Roles('promoter', 'promotor', 'supervisor', 'admin', 'administrador', 'user')
  findAll(@Query() query: { type?: string; all?: string }, @Request() req: any) {
    return this.incidentReasonsService.findAll(query, req.user);
  }

  @Post()
  @Roles('admin', 'administrador', 'supervisor')
  create(@Body() dto: CreateIncidentReasonDto) {
    return this.incidentReasonsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'administrador', 'supervisor')
  update(@Param('id') id: string, @Body() dto: UpdateIncidentReasonDto) {
    return this.incidentReasonsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'administrador', 'supervisor')
  remove(@Param('id') id: string) {
    return this.incidentReasonsService.remove(id);
  }
}
