import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, BadRequestException } from '@nestjs/common';
import { BreakagesService } from './breakages.service';
import { CreateBreakageDto } from './dto/create-breakage.dto';
import { UpdateBreakageDto } from './dto/update-breakage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('breakages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BreakagesController {
  constructor(private readonly breakagesService: BreakagesService) {}

  @Post()
  @Roles('promoter', 'promotor', 'supervisor', 'admin', 'administrador', 'user')
  create(@Request() req, @Body() createBreakageDto: CreateBreakageDto) {
    const promoterId = req.user.employee?.id;
    if (!promoterId) {
      // Fallback to userId if employee is not present (e.g. admin testing)
      // BUT BreakageReport expects Employee entity relation. 
      // If we use userId here, it might fail FK if userId is not in employees table.
      // For now, let's strictly require employee or try userId if it works (but likely fails).
      // Better to throw error if no employee record found for a promoter action.
      if (req.user.role === 'admin' || req.user.role === 'administrador') {
          // Admins might not have employee record. 
          // If BreakageReport requires Employee, we can't save it without one.
          // We could make promoter nullable? Or optional?
          // Or just fail.
          throw new BadRequestException('Admin user must have an associated employee record to create breakage reports.');
      }
      throw new BadRequestException('User is not linked to an employee record.');
    }
    return this.breakagesService.create(promoterId, createBreakageDto);
  }

  @Get()
  findAll(@Request() req, @Query() query) {
    return this.breakagesService.findAll(query, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.breakagesService.findOne(id);
  }

  @Patch('invoice')
  @Roles('promoter', 'promotor', 'supervisor', 'admin', 'administrador')
  updateInvoice(@Body() updateDto: { ids: string[], invoiceData: UpdateBreakageDto }) {
    return this.breakagesService.updateInvoice(updateDto.ids, updateDto.invoiceData);
  }
}
