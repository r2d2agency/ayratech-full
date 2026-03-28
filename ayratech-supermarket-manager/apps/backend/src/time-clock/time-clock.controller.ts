import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, BadRequestException, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { TimeClockService } from './time-clock.service';
import { CreateTimeClockEventDto, CreateTimeBalanceDto, CreateManualTimeClockDto } from './dto/create-time-clock.dto';
import { UpdateTimeClockEventDto } from './dto/update-time-clock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('time-clock')
export class TimeClockController {
  // Controller for managing time clock events
  constructor(private readonly timeClockService: TimeClockService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createTimeClockEventDto: CreateTimeClockEventDto, @Req() req: any) {
    // Log user details to debug employeeId issues
    console.log('TimeClock Create Request - User:', JSON.stringify({
        id: req.user?.userId,
        username: req.user?.username,
        employeeId: req.user?.employee?.id
    }));

    if (!req.user?.employee?.id) {
        console.error('Create TimeClock: User not linked to employee', req.user);
        throw new BadRequestException('Usuário não vinculado a um funcionário. Contate o RH.');
    }
    return this.timeClockService.create({
        ...createTimeClockEventDto,
        employeeId: req.user.employee.id
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('status/today')
  getTodayStatus(@Req() req: any) {
    if (!req.user?.employee?.id) {
        throw new BadRequestException('Usuário não vinculado a um funcionário. Contate o RH.');
    }
    return this.timeClockService.getTodayStatus(req.user.employee.id);
  }

  @Get()
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('employeeId') employeeId?: string
  ) {
    return this.timeClockService.findAll(startDate, endDate, employeeId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('entry/manual')
  createManual(@Body() data: CreateManualTimeClockDto, @Req() req: any) {
     const editorName = req.user?.name || req.user?.email || 'Admin';
     return this.timeClockService.createManual(data, editorName);
  }

  @Get('export')
  async exportReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('employeeId') employeeId: string,
    @Res() res: Response
  ) {
    const workbook = await this.timeClockService.generateReport(startDate, endDate, employeeId);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_ponto.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/daily')
  getDailyReport(@Query('date') date: string, @Query('employeeId') employeeId?: string) {
    return this.timeClockService.getDailyTimeSheet(date, employeeId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/occurrences')
  getOccurrences(@Query('date') date: string, @Query('employeeId') employeeId?: string) {
    return this.timeClockService.getDailyOccurrences(date, employeeId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/manual')
  getManualMarks(@Query('date') date: string, @Query('employeeId') employeeId?: string) {
    return this.timeClockService.getDailyManualMarks(date, employeeId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/odd')
  getOddMarks(@Query('date') date: string, @Query('employeeId') employeeId?: string) {
    return this.timeClockService.getDailyOddMarks(date, employeeId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/absences')
  getAbsences(@Query('date') date: string, @Query('employeeId') employeeId?: string) {
    return this.timeClockService.getDailyAbsences(date, employeeId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/overtime')
  getOvertime(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.timeClockService.getOvertimeSummary(startDate, endDate, employeeId);
  }

  @Post('balances')
  createBalance(@Body() createBalanceDto: CreateTimeBalanceDto) {
    return this.timeClockService.createBalance(createBalanceDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('balances')
  listBalances(@Query('competence') competence?: string, @Query('employeeId') employeeId?: string) {
    return this.timeClockService.listBalances(competence, employeeId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('balances/upsert')
  upsertBalance(@Body() createBalanceDto: CreateTimeBalanceDto) {
    return this.timeClockService.upsertBalance(createBalanceDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('balances/adjust')
  adjustBalance(@Body() data: { employeeId: string; competence: string; deltaHours: number; reason?: string }, @Req() req: any) {
    const createdBy = req.user?.userId || req.user?.email || null;
    return this.timeClockService.adjustBalance({ ...data, createdBy });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.timeClockService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTimeClockEventDto: UpdateTimeClockEventDto, @Req() req: any) {
    const editorName = req.user?.name || req.user?.email || 'Admin';
    
    // Force manual flag and editor name
    updateTimeClockEventDto.isManual = true;
    updateTimeClockEventDto.editedBy = editorName;
    // Ensure validation status is approved if edited by admin
    updateTimeClockEventDto.validationStatus = 'approved';

    return this.timeClockService.update(id, updateTimeClockEventDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.timeClockService.remove(id);
  }
}
