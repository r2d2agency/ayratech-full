import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { TimeClockEvent } from './entities/time-clock-event.entity';
import { TimeBalance } from './entities/time-balance.entity';
import { TimeBalanceAdjustment } from './entities/time-balance-adjustment.entity';
import { Employee } from '../employees/entities/employee.entity';
import { WorkSchedule } from '../work-schedules/entities/work-schedule.entity';
import { CreateTimeClockEventDto, CreateTimeBalanceDto } from './dto/create-time-clock.dto';
import { UpdateTimeClockEventDto } from './dto/update-time-clock.dto';
import { AbsenceRequest } from '../absences/entities/absence-request.entity';
import { createHash } from 'crypto';

@Injectable()
export class TimeClockService {
  constructor(
    @InjectRepository(TimeClockEvent)
    private eventsRepository: Repository<TimeClockEvent>,
    @InjectRepository(TimeBalance)
    private balancesRepository: Repository<TimeBalance>,
    @InjectRepository(TimeBalanceAdjustment)
    private balanceAdjustmentsRepository: Repository<TimeBalanceAdjustment>,
    @InjectRepository(WorkSchedule)
    private schedulesRepository: Repository<WorkSchedule>,
    @InjectRepository(Employee)
    private employeesRepository: Repository<Employee>,
    @InjectRepository(AbsenceRequest)
    private absencesRepository: Repository<AbsenceRequest>,
  ) {}

  private getCompetenceRange(competence: string) {
    const c = String(competence || '').trim();
    const m = /^(\d{4})-(\d{2})$/.exec(c);
    if (!m) throw new BadRequestException('Competência inválida. Use YYYY-MM.');
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      throw new BadRequestException('Competência inválida. Use YYYY-MM.');
    }
    const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const toYMD = (d: Date) => {
      const y = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    };
    return { startDate: toYMD(start), endDate: toYMD(end), start, end };
  }

  async generateEmployeeTimesheetWorkbook(competence: string, employeeId: string) {
    if (!employeeId) throw new BadRequestException('employeeId é obrigatório.');
    const employee = await this.employeesRepository.findOne({ where: { id: employeeId } });
    if (!employee) throw new BadRequestException('Funcionário não encontrado.');

    const { startDate, endDate } = this.getCompetenceRange(competence);
    const events = await this.findAll(startDate, endDate, employeeId);

    const groupedByDate = new Map<string, TimeClockEvent[]>();
    for (const event of events) {
      const dateKey = event.timestamp.toISOString().split('T')[0];
      if (!groupedByDate.has(dateKey)) groupedByDate.set(dateKey, []);
      groupedByDate.get(dateKey)!.push(event);
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Folha de Ponto');

    const title = `Folha de Ponto - ${String(competence || '').trim()}`;
    ws.addRow([title]);
    ws.addRow([`Funcionário: ${employee.fullName}`]);
    if (employee.cpf) ws.addRow([`CPF: ${employee.cpf}`]);
    ws.addRow([]);

    ws.columns = [
      { header: 'Data', key: 'date', width: 14 },
      { header: 'Entrada', key: 'entry', width: 12 },
      { header: 'Início Almoço', key: 'lunchStart', width: 14 },
      { header: 'Fim Almoço', key: 'lunchEnd', width: 12 },
      { header: 'Saída', key: 'exit', width: 12 },
      { header: 'Total Horas', key: 'totalHours', width: 12 },
      { header: 'Observações', key: 'observations', width: 40 },
    ];

    const formatTime = (date?: Date) =>
      date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';

    const dates = Array.from(groupedByDate.keys()).sort();
    const dataForHash: any[] = [];
    let totalMs = 0;
    for (const dateKey of dates) {
      const dayEvents = groupedByDate.get(dateKey)!;
      dayEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const entry = dayEvents.find(e => e.eventType === 'ENTRY');
      const lunchStart = dayEvents.find(e => e.eventType === 'LUNCH_START');
      const lunchEnd = dayEvents.find(e => e.eventType === 'LUNCH_END');
      const exit = dayEvents.find(e => e.eventType === 'EXIT');

      let dayMs = 0;
      const observations: string[] = [];
      if (dayEvents.some(e => e.isManual)) observations.push('Contém ajustes manuais');

      if (entry && lunchStart) dayMs += lunchStart.timestamp.getTime() - entry.timestamp.getTime();
      if (lunchEnd && exit) dayMs += exit.timestamp.getTime() - lunchEnd.timestamp.getTime();
      if (entry && exit && !lunchStart && !lunchEnd) dayMs += exit.timestamp.getTime() - entry.timestamp.getTime();

      totalMs += Math.max(0, dayMs);
      const totalHours = dayMs > 0 ? (dayMs / (1000 * 60 * 60)).toFixed(2) : '0.00';

      dataForHash.push({
        date: dateKey,
        entry: entry?.timestamp ? entry.timestamp.toISOString() : null,
        lunchStart: lunchStart?.timestamp ? lunchStart.timestamp.toISOString() : null,
        lunchEnd: lunchEnd?.timestamp ? lunchEnd.timestamp.toISOString() : null,
        exit: exit?.timestamp ? exit.timestamp.toISOString() : null,
        hasManualAdjustments: dayEvents.some(e => e.isManual) || false,
      });

      ws.addRow({
        date: new Date(`${dateKey}T00:00:00`).toLocaleDateString('pt-BR'),
        entry: formatTime(entry?.timestamp),
        lunchStart: formatTime(lunchStart?.timestamp),
        lunchEnd: formatTime(lunchEnd?.timestamp),
        exit: formatTime(exit?.timestamp),
        totalHours,
        observations: observations.join(', '),
      } as any);
    }

    ws.addRow([]);
    ws.addRow([`Total do mês (horas): ${(totalMs / (1000 * 60 * 60)).toFixed(2)}`]);
    ws.addRow([]);
    const dataHash = createHash('sha256')
      .update(JSON.stringify({ competence: String(competence || '').trim(), employeeId, days: dataForHash, totalMs }))
      .digest('hex');
    ws.addRow([`Hash dos dados do ponto (SHA-256): ${dataHash}`]);
    ws.addRow([]);
    ws.addRow(['Assinatura do Funcionário: ________________________________']);
    ws.addRow(['Data: ____/____/________']);

    return workbook;
  }

  async generateGeneralTimesheetWorkbook(competence: string) {
    const { startDate, endDate } = this.getCompetenceRange(competence);
    return this.generateReport(startDate, endDate);
  }

  async generateReport(startDate?: string, endDate?: string, employeeId?: string) {
    const events = await this.findAll(startDate, endDate, employeeId);
    
    // Group by employee and date
    const groupedData = new Map<string, Map<string, TimeClockEvent[]>>();

    events.forEach(event => {
      const empId = event.employee.id;
      const dateKey = event.timestamp.toISOString().split('T')[0];
      
      if (!groupedData.has(empId)) {
        groupedData.set(empId, new Map());
      }
      
      const empDates = groupedData.get(empId);
      if (!empDates.has(dateKey)) {
        empDates.set(dateKey, []);
      }
      
      empDates.get(dateKey).push(event);
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório de Ponto');

    worksheet.columns = [
      { header: 'Funcionário', key: 'employee', width: 30 },
      { header: 'Data', key: 'date', width: 15 },
      { header: 'Entrada', key: 'entry', width: 15 },
      { header: 'Início Almoço', key: 'lunchStart', width: 15 },
      { header: 'Fim Almoço', key: 'lunchEnd', width: 15 },
      { header: 'Saída', key: 'exit', width: 15 },
      { header: 'Total Horas', key: 'totalHours', width: 15 },
      { header: 'Observações', key: 'observations', width: 30 },
    ];

    groupedData.forEach((dates, empId) => {
      dates.forEach((dayEvents, dateKey) => {
        // Sort events by time
        dayEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        const entry = dayEvents.find(e => e.eventType === 'ENTRY');
        const lunchStart = dayEvents.find(e => e.eventType === 'LUNCH_START');
        const lunchEnd = dayEvents.find(e => e.eventType === 'LUNCH_END');
        const exit = dayEvents.find(e => e.eventType === 'EXIT');

        let totalMilliseconds = 0;
        let observations = [];

        if (dayEvents.some(e => e.isManual)) {
          observations.push('Contém ajustes manuais');
        }

        // Calculate hours
        if (entry && lunchStart) {
          totalMilliseconds += lunchStart.timestamp.getTime() - entry.timestamp.getTime();
        }
        if (lunchEnd && exit) {
          totalMilliseconds += exit.timestamp.getTime() - lunchEnd.timestamp.getTime();
        }
        // Fallback for continuous shift (Entry -> Exit)
        if (entry && exit && !lunchStart && !lunchEnd) {
          totalMilliseconds += exit.timestamp.getTime() - entry.timestamp.getTime();
        }

        const totalHours = totalMilliseconds > 0 ? (totalMilliseconds / (1000 * 60 * 60)).toFixed(2) : '0.00';

        // Format times
        const formatTime = (date?: Date) => date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';

        worksheet.addRow({
          employee: dayEvents[0].employee.fullName,
          date: new Date(dateKey).toLocaleDateString('pt-BR'),
          entry: formatTime(entry?.timestamp),
          lunchStart: formatTime(lunchStart?.timestamp),
          lunchEnd: formatTime(lunchEnd?.timestamp),
          exit: formatTime(exit?.timestamp),
          totalHours: totalHours,
          observations: observations.join(', ')
        });
      });
    });

    const sortedEvents = [...events].sort((a, b) => {
      const ae = a.employee?.id || '';
      const be = b.employee?.id || '';
      if (ae !== be) return ae.localeCompare(be);
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
    const dataHash = createHash('sha256')
      .update(
        JSON.stringify({
          startDate: startDate || null,
          endDate: endDate || null,
          employeeId: employeeId || null,
          events: sortedEvents.map(e => ({
            employeeId: e.employee?.id || null,
            timestamp: e.timestamp?.toISOString() || null,
            eventType: e.eventType,
            isManual: !!e.isManual,
          })),
        }),
      )
      .digest('hex');

    worksheet.addRow([]);
    worksheet.addRow([`Hash dos dados do ponto (SHA-256): ${dataHash}`]);

    return workbook;
  }

  async create(createTimeClockEventDto: CreateTimeClockEventDto) {
    const { employeeId } = createTimeClockEventDto;
    try {
      console.log('Creating time clock event via App:', JSON.stringify(createTimeClockEventDto));
      // Remove employeeId from eventData to prevent conflicts with insert: false column
      const { timestamp, employeeId: _, ...eventData } = createTimeClockEventDto;
      
      // Validate if employee exists/is provided
      if (!employeeId) {
          console.error('Create TimeClock: Employee ID is missing!');
          throw new BadRequestException('Employee ID is required');
      }

      // Verify if employee actually exists to avoid Not Null violations on relation
      const employee = await this.employeesRepository.findOne({ where: { id: employeeId } });
      if (!employee) {
          throw new BadRequestException(`Funcionário não encontrado (ID: ${employeeId}).`);
      }

      // Ensure coords are numbers if provided
      if (eventData.latitude) eventData.latitude = Number(eventData.latitude);
      if (eventData.longitude) eventData.longitude = Number(eventData.longitude);

      // Check daily limit (4 punches)
      // Only for non-manual entries (app usage)
      if (!eventData['isManual']) {
        const date = new Date(timestamp);
        const todayStart = new Date(date);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(date);
        todayEnd.setHours(23, 59, 59, 999);

        const todayCount = await this.eventsRepository.count({
          where: {
            employee: { id: employeeId },
            timestamp: Between(todayStart, todayEnd)
          }
        });

        if (todayCount >= 4) {
          throw new BadRequestException('Limite de 4 batidas diárias atingido.');
        }
      }

      console.log(`Saving event for employee: ${employeeId}`);

      // Use QueryBuilder to force insertion, bypassing repository/entity metadata constraints
      // This ensures 'employeeId' column is populated even if marked as insert: false in entity
      const insertResult = await this.eventsRepository.createQueryBuilder()
        .insert()
        .into(TimeClockEvent)
        .values({
          ...eventData,
          employeeId: employeeId, // Explicitly set column
          timestamp: new Date(timestamp),
          validationStatus: eventData.validationStatus || 'pending'
        })
        .returning('*')
        .execute();

      const savedEvent = insertResult.generatedMaps[0] as TimeClockEvent;
      
      console.log('Time clock event saved (via QueryBuilder):', savedEvent.id);
      return savedEvent;
    } catch (error) {
      console.error('Error saving time clock event:', error);
      // Return a more meaningful error if possible
      if (error.code === '23503') { // Foreign key violation
         throw new BadRequestException('Funcionário não encontrado ou inválido.');
      }
      if (error.code === '23502') { // Not null violation
         console.error('Not Null Violation Details:', error.detail, error.column);
         if (error.column === 'employeeId') {
             throw new BadRequestException(`Erro interno: ID do funcionário não processado corretamente (${employeeId}).`);
         }
      }
      throw error;
    }
  }

  async getTodayStatus(employeeId: string) {
    // FIX: Use Brazil Time (UTC-3) to determine "Today"
    // This prevents the "day reset" that happens at 21:00 Local (00:00 UTC)
    const now = new Date();
    // Adjust to UTC-3
    const brazilOffset = 3 * 60 * 60 * 1000; 
    const brazilTime = new Date(now.getTime() - brazilOffset);
    
    // Set to start of day (00:00:00) in Brazil Time (stored as UTC)
    brazilTime.setUTCHours(0, 0, 0, 0);
    
    // Convert back to real UTC for DB query
    // Start: 00:00 Local -> 03:00 UTC
    const start = new Date(brazilTime.getTime() + brazilOffset);
    
    // End: 23:59:59 Local -> 02:59:59 UTC Next Day
    const end = new Date(start.getTime() + (24 * 60 * 60 * 1000) - 1);

    const events = await this.eventsRepository.find({
        where: {
            employee: { id: employeeId },
            timestamp: Between(start, end)
        },
        order: { timestamp: 'ASC' }
    });

    // Determine next expected action
    let nextAction = 'ENTRY';
    let status = 'PENDING'; // PENDING | WORKING | LUNCH | DONE

    if (events.length > 0) {
        const lastEvent = events[events.length - 1];
        switch (lastEvent.eventType) {
            case 'ENTRY': 
                nextAction = 'LUNCH_START'; 
                status = 'WORKING';
                break;
            case 'LUNCH_START': 
                nextAction = 'LUNCH_END'; 
                status = 'LUNCH';
                break;
            case 'LUNCH_END': 
                nextAction = 'EXIT'; 
                status = 'WORKING';
                break;
            case 'EXIT': 
                nextAction = 'DONE'; 
                status = 'DONE';
                break;
        }
    }

    // Fetch Schedule for Today
    let scheduleRule = null;
    const allSchedules = await this.schedulesRepository.find({
        where: { employee: { id: employeeId } },
        relations: ['days'],
        order: { validFrom: 'DESC' }
    });

    const activeSchedule = allSchedules.find(s => {
        const start = new Date(s.validFrom);
        const end = s.validTo ? new Date(s.validTo) : new Date(9999, 11, 31);
        return now >= start && now <= end;
    });

    if (activeSchedule) {
        const dayOfWeek = now.getDay(); // 0-6
        const todayRule = activeSchedule.days.find(d => d.dayOfWeek === dayOfWeek && d.active);
        
        if (todayRule) {
            scheduleRule = {
                startTime: todayRule.startTime,
                endTime: todayRule.endTime,
                breakStart: todayRule.breakStart,
                breakEnd: todayRule.breakEnd,
                toleranceMinutes: todayRule.toleranceMinutes
            };
        }
    }

    return {
        events,
        nextAction,
        status,
        schedule: scheduleRule,
        summary: {
             entry: events.find(e => e.eventType === 'ENTRY')?.timestamp,
             lunchStart: events.find(e => e.eventType === 'LUNCH_START')?.timestamp,
             lunchEnd: events.find(e => e.eventType === 'LUNCH_END')?.timestamp,
             exit: events.find(e => e.eventType === 'EXIT')?.timestamp,
        }
    };
  }

  async createManual(data: any, editorName: string) {
    console.log('Creating manual time clock entry:', JSON.stringify(data));
    const { employeeId, timestamp, eventType, observation } = data;
    
    if (!employeeId) throw new BadRequestException('Employee ID is required');
    if (!timestamp) throw new BadRequestException('Timestamp is required');
    if (!eventType) throw new BadRequestException('Event Type is required');

    const eventDate = new Date(timestamp);
    if (isNaN(eventDate.getTime())) {
        throw new BadRequestException('Invalid timestamp format');
    }

    try {
        // Use explicit assignment to handle TypeORM relations correctly (insert: false columns)
        // Use save directly with object to match create() method pattern which works
        return await this.eventsRepository.save({
            employee: { id: employeeId },
            eventType,
            timestamp: eventDate,
            isManual: true,
            editedBy: editorName,
            validationReason: observation || 'Ajuste manual',
            validationStatus: 'approved'
        });
    } catch (error) {
        console.error('Error creating manual time clock entry:', error);
        console.error('Error details (code/message):', error.code, error.message);
        
        if (error.code === '23503') { // Foreign key violation
            throw new BadRequestException('Employee not found');
        }
        if (error.code === '22P02') { // Invalid text representation (e.g. invalid UUID)
             throw new BadRequestException('Invalid Employee ID format (must be UUID)');
        }
        throw new BadRequestException(`Error saving time clock: ${error.message}`);
    }
  }

  async findAll(startDate?: string, endDate?: string, employeeId?: string) {
    console.log(`Finding time clock events. Start: ${startDate}, End: ${endDate}, Employee: ${employeeId}`);
    const where: any = {};
    
    if (employeeId) {
        where.employee = { id: employeeId };
    }

    if (startDate && endDate) {
        // Ensure dates cover the full day range if strings are passed
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        // Adjust for timezone differences (extend end date to cover late entries in Western timezones)
        end.setHours(end.getHours() + 4);
        
        where.timestamp = Between(start, end);
    } else if (startDate) {
        // Just that day
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        const end = new Date(startDate);
        end.setHours(23,59,59,999);
        // Adjust for timezone differences
        end.setHours(end.getHours() + 4);
        where.timestamp = Between(start, end);
    }

    const results = await this.eventsRepository.find({ 
        where, 
        relations: ['employee'], 
        order: { timestamp: 'DESC' } 
    });
    console.log(`Found ${results.length} events.`);
    return results;
  }

  findOne(id: string) {
    return this.eventsRepository.findOne({ where: { id }, relations: ['employee'] });
  }

  update(id: string, updateTimeClockEventDto: UpdateTimeClockEventDto) {
    return this.eventsRepository.update(id, updateTimeClockEventDto);
  }

  remove(id: string) {
    return this.eventsRepository.delete(id);
  }

  createBalance(createBalanceDto: CreateTimeBalanceDto) {
    const balance = this.balancesRepository.create(createBalanceDto);
    return this.balancesRepository.save(balance);
  }

  async listBalances(competence?: string, employeeId?: string) {
    const where: any = {};
    if (competence) where.competence = competence;
    if (employeeId) where.employee = { id: employeeId };
    return this.balancesRepository.find({
      where,
      relations: ['employee'],
      order: { competence: 'DESC', createdAt: 'DESC' } as any,
    });
  }

  async upsertBalance(createBalanceDto: CreateTimeBalanceDto) {
    const { employeeId, competence } = createBalanceDto as any;
    if (!employeeId || !competence) {
      throw new BadRequestException('employeeId e competence são obrigatórios');
    }

    const existing = await this.balancesRepository.findOne({
      where: { employeeId, competence } as any,
    });

    if (existing) {
      await this.balancesRepository.update(existing.id, {
        expectedHours: createBalanceDto.expectedHours,
        workedHours: createBalanceDto.workedHours,
        overtimeHours: createBalanceDto.overtimeHours,
        balanceHours: createBalanceDto.balanceHours,
      } as any);
      return this.balancesRepository.findOne({ where: { id: existing.id }, relations: ['employee'] });
    }

    const employee = await this.employeesRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new BadRequestException('Funcionário não encontrado');
    }

    const balance = this.balancesRepository.create({
      ...createBalanceDto,
      employeeId,
      employee,
    } as any);
    return this.balancesRepository.save(balance);
  }

  async adjustBalance(input: { employeeId: string; competence: string; deltaHours: number; reason?: string; createdBy?: string }) {
    const employeeId = input.employeeId;
    const competence = String(input.competence || '').trim();
    const deltaHours = Number(input.deltaHours);
    if (!employeeId || !competence || !Number.isFinite(deltaHours)) {
      throw new BadRequestException('employeeId, competence e deltaHours são obrigatórios');
    }

    const employee = await this.employeesRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new BadRequestException('Funcionário não encontrado');
    }

    const adjustment = this.balanceAdjustmentsRepository.create({
      employeeId,
      employee,
      competence,
      deltaHours,
      reason: input.reason || null,
      createdBy: input.createdBy || null,
    } as any);
    await this.balanceAdjustmentsRepository.save(adjustment);

    const existing = await this.balancesRepository.findOne({ where: { employeeId, competence } as any });
    if (existing) {
      const next = Number(existing.balanceHours) + deltaHours;
      await this.balancesRepository.update(existing.id, { balanceHours: next } as any);
      return this.balancesRepository.findOne({ where: { id: existing.id }, relations: ['employee'] });
    }

    const balance = this.balancesRepository.create({
      employeeId,
      employee,
      competence,
      expectedHours: 0,
      workedHours: 0,
      overtimeHours: 0,
      balanceHours: deltaHours,
    } as any);
    return this.balancesRepository.save(balance);
  }

  async getDailyTimeSheet(date: string, employeeId?: string) {
    const dateStr = this.normalizeDate(date);
    const employees = employeeId
      ? await this.employeesRepository.find({ where: { id: employeeId } as any })
      : await this.employeesRepository.find({ where: { status: 'active' } as any, order: { fullName: 'ASC' } as any });

    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(`${dateStr}T23:59:59.999Z`);
    end.setHours(end.getHours() + 4);

    const absences = await this.absencesRepository.query(
      `SELECT * FROM "absence_requests"
       WHERE "status" != 'rejected'
         AND (COALESCE("endDate","startDate") >= $1)
         AND ("startDate" <= $1)
         ${employeeId ? `AND "employeeId" = $2` : ''}`,
      employeeId ? [dateStr, employeeId] : [dateStr],
    );
    const absencesByEmployee = new Map<string, any[]>();
    for (const a of absences || []) {
      const eid = a.employeeId;
      if (!eid) continue;
      if (!absencesByEmployee.has(eid)) absencesByEmployee.set(eid, []);
      absencesByEmployee.get(eid).push(a);
    }

    const events = await this.eventsRepository.find({
      where: {
        ...(employeeId ? { employeeId } : {}),
        timestamp: Between(start, end),
      } as any,
      relations: ['employee'],
      order: { timestamp: 'ASC' } as any,
    });

    const eventsByEmployee = new Map<string, TimeClockEvent[]>();
    for (const ev of events) {
      const eid = ev.employeeId || ev.employee?.id;
      if (!eid) continue;
      if (!eventsByEmployee.has(eid)) eventsByEmployee.set(eid, []);
      eventsByEmployee.get(eid).push(ev);
    }

    const rows: any[] = [];
    for (const emp of employees) {
      const empEvents = eventsByEmployee.get(emp.id) || [];
      const scheduleDay = await this.getScheduleDay(emp.id, dateStr);
      const entry = empEvents.find(e => e.eventType === 'ENTRY');
      const lunchStart = empEvents.find(e => e.eventType === 'LUNCH_START');
      const lunchEnd = empEvents.find(e => e.eventType === 'LUNCH_END');
      const exit = empEvents.find(e => e.eventType === 'EXIT');

      const workedMinutes = this.calculateWorkedMinutes(entry?.timestamp, lunchStart?.timestamp, lunchEnd?.timestamp, exit?.timestamp);
      const expectedMinutes = scheduleDay ? this.calculateExpectedMinutes(scheduleDay.startTime, scheduleDay.endTime, scheduleDay.breakStart, scheduleDay.breakEnd) : null;

      const absenceList = absencesByEmployee.get(emp.id) || [];
      const hasAbsence = absenceList.length > 0;

      rows.push({
        employeeId: emp.id,
        employeeName: emp.fullName,
        date: dateStr,
        schedule: scheduleDay ? `${scheduleDay.startTime}-${scheduleDay.endTime}` : null,
        entry: entry ? this.formatTime(entry.timestamp) : null,
        lunchStart: lunchStart ? this.formatTime(lunchStart.timestamp) : null,
        lunchEnd: lunchEnd ? this.formatTime(lunchEnd.timestamp) : null,
        exit: exit ? this.formatTime(exit.timestamp) : null,
        punchesCount: empEvents.length,
        hasOddPunches: empEvents.length % 2 === 1,
        hasManual: empEvents.some(e => e.isManual),
        workedMinutes,
        expectedMinutes,
        overtimeMinutes: expectedMinutes != null ? Math.max(0, workedMinutes - expectedMinutes) : null,
        missingMinutes: expectedMinutes != null ? Math.max(0, expectedMinutes - workedMinutes) : null,
        absences: hasAbsence ? absenceList.map(a => ({ type: a.type, status: a.status, startDate: String(a.startDate).slice(0, 10), endDate: a.endDate ? String(a.endDate).slice(0, 10) : null })) : [],
      });
    }

    return rows;
  }

  async getDailyOccurrences(date: string, employeeId?: string) {
    const dateStr = this.normalizeDate(date);
    const rows = await this.getDailyTimeSheet(dateStr, employeeId);
    const occurrences: any[] = [];
    for (const row of rows) {
      const scheduleDay = await this.getScheduleDay(row.employeeId, dateStr);
      const hasAbsence = Array.isArray(row.absences) && row.absences.length > 0;
      if (!scheduleDay) continue;

      const expectedTypes = ['ENTRY', 'EXIT'];
      if (scheduleDay.breakStart) expectedTypes.push('LUNCH_START');
      if (scheduleDay.breakEnd) expectedTypes.push('LUNCH_END');

      const missing: string[] = [];
      if (!row.entry) missing.push('ENTRY');
      if (!row.exit) missing.push('EXIT');
      if (scheduleDay.breakStart && !row.lunchStart) missing.push('LUNCH_START');
      if (scheduleDay.breakEnd && !row.lunchEnd) missing.push('LUNCH_END');

      if (!hasAbsence && missing.length === expectedTypes.length) {
        occurrences.push({ employeeId: row.employeeId, employeeName: row.employeeName, date: dateStr, type: 'FALTA_SUSPEITA', detail: 'Sem marcações no dia' });
      }

      for (const t of missing) {
        occurrences.push({ employeeId: row.employeeId, employeeName: row.employeeName, date: dateStr, type: 'MARCACAO_FALTANDO', detail: t });
      }

      if (row.hasOddPunches) {
        occurrences.push({ employeeId: row.employeeId, employeeName: row.employeeName, date: dateStr, type: 'MARCACOES_IMPARES', detail: `Total: ${row.punchesCount}` });
      }

      if (row.hasManual) {
        occurrences.push({ employeeId: row.employeeId, employeeName: row.employeeName, date: dateStr, type: 'MARCACAO_MANUAL', detail: 'Contém ajuste manual' });
      }

      if (row.entry) {
        const lateMinutes = this.diffLateMinutes(scheduleDay.startTime, row.entry, scheduleDay.toleranceMinutes);
        if (lateMinutes > 0) {
          occurrences.push({ employeeId: row.employeeId, employeeName: row.employeeName, date: dateStr, type: 'ATRASO', detail: `${lateMinutes} min` });
        }
      }

      if (row.exit) {
        const earlyMinutes = this.diffEarlyMinutes(scheduleDay.endTime, row.exit, scheduleDay.toleranceMinutes);
        if (earlyMinutes > 0) {
          occurrences.push({ employeeId: row.employeeId, employeeName: row.employeeName, date: dateStr, type: 'SAIDA_ANTECIPADA', detail: `${earlyMinutes} min` });
        }
      }
    }

    return occurrences;
  }

  async getDailyManualMarks(date: string, employeeId?: string) {
    const dateStr = this.normalizeDate(date);
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(`${dateStr}T23:59:59.999Z`);
    end.setHours(end.getHours() + 4);

    const where: any = { timestamp: Between(start, end), isManual: true };
    if (employeeId) where.employeeId = employeeId;
    return this.eventsRepository.find({
      where,
      relations: ['employee'],
      order: { timestamp: 'ASC' } as any,
    });
  }

  async getDailyOddMarks(date: string, employeeId?: string) {
    const dateStr = this.normalizeDate(date);
    const sheet = await this.getDailyTimeSheet(dateStr, employeeId);
    return sheet.filter(r => r.punchesCount % 2 === 1);
  }

  async getDailyAbsences(date: string, employeeId?: string) {
    const dateStr = this.normalizeDate(date);
    const rows = await this.absencesRepository.query(
      `SELECT * FROM "absence_requests"
       WHERE "status" != 'rejected'
         AND (COALESCE("endDate","startDate") >= $1)
         AND ("startDate" <= $1)
         ${employeeId ? `AND "employeeId" = $2` : ''}`,
      employeeId ? [dateStr, employeeId] : [dateStr],
    );
    return rows || [];
  }

  async getOvertimeSummary(startDate: string, endDate: string, employeeId?: string) {
    const startStr = this.normalizeDate(startDate);
    const endStr = this.normalizeDate(endDate);
    const days = this.enumerateDays(startStr, endStr);

    const employees = employeeId
      ? await this.employeesRepository.find({ where: { id: employeeId } as any })
      : await this.employeesRepository.find({ where: { status: 'active' } as any, order: { fullName: 'ASC' } as any });

    const totals = new Map<string, any>();
    for (const emp of employees) {
      totals.set(emp.id, {
        employeeId: emp.id,
        employeeName: emp.fullName,
        overtime50Minutes: 0,
        overtime100Minutes: 0,
        nightMinutes: 0,
        bankMinutes: 0,
        missingMinutes: 0,
      });
    }

    for (const day of days) {
      const sheet = await this.getDailyTimeSheet(day, employeeId);
      const d = new Date(`${day}T12:00:00.000Z`);
      const isSunday = d.getUTCDay() === 0;
      for (const row of sheet) {
        const t = totals.get(row.employeeId);
        if (!t) continue;
        const expected = row.expectedMinutes;
        const worked = row.workedMinutes;
        if (typeof expected !== 'number') continue;

        const delta = worked - expected;
        if (delta > 0) {
          if (isSunday) t.overtime100Minutes += delta;
          else t.overtime50Minutes += delta;
        } else if (delta < 0) {
          t.missingMinutes += Math.abs(delta);
        }

        t.bankMinutes += delta;
        t.nightMinutes += this.calculateNightMinutes(row.entry, row.lunchStart, row.lunchEnd, row.exit);
      }
    }

    return Array.from(totals.values()).map(r => ({
      ...r,
      overtime50Hours: this.minutesToHours(r.overtime50Minutes),
      overtime100Hours: this.minutesToHours(r.overtime100Minutes),
      nightHours: this.minutesToHours(r.nightMinutes),
      bankHours: this.minutesToHours(r.bankMinutes),
      missingHours: this.minutesToHours(r.missingMinutes),
    }));
  }

  private normalizeDate(value: string) {
    const s = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      throw new BadRequestException('Data inválida (use YYYY-MM-DD)');
    }
    return s;
  }

  private enumerateDays(start: string, end: string) {
    const out: string[] = [];
    let d = new Date(`${start}T12:00:00.000Z`);
    const endD = new Date(`${end}T12:00:00.000Z`);
    while (d.getTime() <= endD.getTime()) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  private async getScheduleDay(employeeId: string, dateStr: string) {
    const schedules = await this.schedulesRepository.find({
      where: { employeeId } as any,
      relations: ['days'],
      order: { validFrom: 'DESC' } as any,
    });
    const date = new Date(`${dateStr}T12:00:00.000Z`);
    const schedule = (schedules || []).find(s => {
      const from = s.validFrom ? new Date(s.validFrom) : null;
      const to = s.validTo ? new Date(s.validTo) : null;
      if (!from) return false;
      const okFrom = from.getTime() <= date.getTime();
      const okTo = !to || to.getTime() >= date.getTime();
      return okFrom && okTo;
    });
    if (!schedule || !Array.isArray(schedule.days)) return null;
    const dow = date.getUTCDay();
    const day = schedule.days.find(d => Number(d.dayOfWeek) === dow && d.active);
    return day || null;
  }

  private timeToMinutes(t: string) {
    const [h, m] = String(t || '').split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }

  private formatTime(d: Date) {
    return d.toISOString().slice(11, 16);
  }

  private calculateWorkedMinutes(entry?: Date, lunchStart?: Date, lunchEnd?: Date, exit?: Date) {
    const ms = (a?: Date, b?: Date) => (a && b ? b.getTime() - a.getTime() : 0);
    let total = 0;
    if (entry && lunchStart) total += ms(entry, lunchStart);
    if (lunchEnd && exit) total += ms(lunchEnd, exit);
    if (entry && exit && !lunchStart && !lunchEnd) total += ms(entry, exit);
    return Math.max(0, Math.floor(total / (1000 * 60)));
  }

  private calculateExpectedMinutes(startTime: string, endTime: string, breakStart?: string, breakEnd?: string) {
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    let expected = Math.max(0, end - start);
    if (breakStart && breakEnd) {
      expected -= Math.max(0, this.timeToMinutes(breakEnd) - this.timeToMinutes(breakStart));
    }
    return Math.max(0, expected);
  }

  private diffLateMinutes(scheduleStart: string, entryHHMM: string, tolerance: number) {
    const sched = this.timeToMinutes(scheduleStart) + (Number(tolerance) || 0);
    const entry = this.timeToMinutes(entryHHMM);
    return Math.max(0, entry - sched);
  }

  private diffEarlyMinutes(scheduleEnd: string, exitHHMM: string, tolerance: number) {
    const sched = this.timeToMinutes(scheduleEnd) - (Number(tolerance) || 0);
    const out = this.timeToMinutes(exitHHMM);
    return Math.max(0, sched - out);
  }

  private calculateNightMinutes(entry?: string | null, lunchStart?: string | null, lunchEnd?: string | null, exit?: string | null) {
    const intervals: Array<[number, number]> = [];
    const toMin = (hhmm?: string | null) => (hhmm ? this.timeToMinutes(hhmm) : null);
    const e = toMin(entry);
    const ls = toMin(lunchStart);
    const le = toMin(lunchEnd);
    const ex = toMin(exit);
    if (e != null && ls != null) intervals.push([e, ls]);
    if (le != null && ex != null) intervals.push([le, ex]);
    if (e != null && ex != null && ls == null && le == null) intervals.push([e, ex]);

    const night1: [number, number] = [22 * 60, 24 * 60];
    const night2: [number, number] = [0, 5 * 60];
    let total = 0;
    for (const [a, b] of intervals) {
      total += this.overlapMinutes(a, b, night1[0], night1[1]);
      total += this.overlapMinutes(a, b, night2[0], night2[1]);
    }
    return total;
  }

  private overlapMinutes(a1: number, a2: number, b1: number, b2: number) {
    const start = Math.max(a1, b1);
    const end = Math.min(a2, b2);
    return Math.max(0, end - start);
  }

  private minutesToHours(min: number) {
    const n = Number(min) || 0;
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
