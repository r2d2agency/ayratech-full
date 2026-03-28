import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { AbsencesService } from './absences.service';
import { CreateAbsenceRequestDto } from './dto/create-absence-request.dto';
import { UpdateAbsenceRequestDto } from './dto/update-absence-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('absences')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'rh', 'manager', 'supervisor de operações')
export class AbsencesController {
  constructor(private readonly absencesService: AbsencesService) {}

  @Post()
  create(@Body() createAbsenceRequestDto: CreateAbsenceRequestDto) {
    return this.absencesService.create(createAbsenceRequestDto);
  }

  @Get()
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.absencesService.findAll({ employeeId, startDate, endDate });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.absencesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAbsenceRequestDto: UpdateAbsenceRequestDto) {
    return this.absencesService.update(id, updateAbsenceRequestDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.absencesService.remove(id);
  }
}
