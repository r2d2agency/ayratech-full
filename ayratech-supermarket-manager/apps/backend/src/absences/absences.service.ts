import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AbsenceRequest } from './entities/absence-request.entity';
import { CreateAbsenceRequestDto } from './dto/create-absence-request.dto';
import { UpdateAbsenceRequestDto } from './dto/update-absence-request.dto';
import { Route } from '../routes/entities/route.entity';
import { Employee } from '../employees/entities/employee.entity';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

type FindAllFilters = {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
};

@Injectable()
export class AbsencesService {
  private readonly logger = new Logger(AbsencesService.name);

  constructor(
    @InjectRepository(AbsenceRequest)
    private absencesRepository: Repository<AbsenceRequest>,
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
    @InjectRepository(Employee)
    private employeesRepository: Repository<Employee>,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
  ) {}

  async create(createAbsenceRequestDto: CreateAbsenceRequestDto) {
    const {
      employeeId,
      approverId,
      startDate,
      endDate,
      employeeDocumentId,
      status,
      ...absenceData
    } = createAbsenceRequestDto;

    if (!employeeId) {
      throw new BadRequestException('employeeId é obrigatório.');
    }
    if (!startDate) {
      throw new BadRequestException('startDate é obrigatório.');
    }

    if (String(absenceData?.type || '') === 'atestado') {
      const missing: string[] = [];
      if (!absenceData.medicalCid) missing.push('CID');
      if (!absenceData.medicalProfessionalName) missing.push('nome do médico');
      if (!absenceData.medicalServiceLocation) missing.push('local de atendimento');
      if (!absenceData.medicalLicenseNumber) missing.push('CRM');
      if (missing.length) {
        throw new BadRequestException(`Para atestado, informe: ${missing.join(', ')}.`);
      }
      (absenceData as any).medicalLicenseType = 'CRM';
    }

    const absence = this.absencesRepository.create({
      ...absenceData,
      status: status || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : null,
      employeeDocumentId: employeeDocumentId || null,
      employeeId,
      employee: { id: employeeId },
      approverId: approverId || null,
      approver: approverId ? { id: approverId } : null,
    });

    const saved = await this.absencesRepository.save(absence);
    await this.notifySupervisorIfRoutesAffected(saved.id);
    return this.findOne(saved.id);
  }

  findAll(filters: FindAllFilters = {}) {
    const qb = this.absencesRepository
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.employee', 'employee')
      .leftJoinAndSelect('a.approver', 'approver')
      .leftJoinAndSelect('a.employeeDocument', 'employeeDocument')
      .orderBy('a.startDate', 'DESC')
      .addOrderBy('a.createdAt', 'DESC');

    if (filters.employeeId) {
      qb.andWhere('a.employeeId = :employeeId', { employeeId: filters.employeeId });
    }

    const startDate = filters.startDate ? String(filters.startDate).slice(0, 10) : '';
    const endDate = filters.endDate ? String(filters.endDate).slice(0, 10) : '';

    if (startDate || endDate) {
      const rangeStart = startDate || endDate;
      const rangeEnd = endDate || startDate;

      qb.andWhere('a.startDate <= :rangeEnd', { rangeEnd })
        .andWhere('(a.endDate IS NULL OR a.endDate >= :rangeStart)', { rangeStart });
    }

    return qb.getMany();
  }

  findOne(id: string) {
    return this.absencesRepository.findOne({
      where: { id },
      relations: ['employee', 'approver', 'employeeDocument'],
    });
  }

  async update(id: string, updateAbsenceRequestDto: UpdateAbsenceRequestDto) {
    if (Object.keys(updateAbsenceRequestDto).length > 0) {
      const { startDate, endDate, approvedAt, ...rest } = updateAbsenceRequestDto as any;
      const type = String(rest?.type || '');
      if (type === 'atestado') {
        const missing: string[] = [];
        if (!rest.medicalCid) missing.push('CID');
        if (!rest.medicalProfessionalName) missing.push('nome do médico');
        if (!rest.medicalServiceLocation) missing.push('local de atendimento');
        if (!rest.medicalLicenseNumber) missing.push('CRM');
        if (missing.length) {
          throw new BadRequestException(`Para atestado, informe: ${missing.join(', ')}.`);
        }
        rest.medicalLicenseType = 'CRM';
      }
      await this.absencesRepository.update(id, {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        approvedAt: approvedAt ? new Date(approvedAt) : undefined,
      });
    }
    const updated = await this.findOne(id);
    if (updated) {
      await this.notifySupervisorIfRoutesAffected(updated.id);
    }
    return updated;
  }

  remove(id: string) {
    return this.absencesRepository.delete(id);
  }

  async hasAbsenceOnDate(employeeId: string, date: string): Promise<boolean> {
    const absences = await this.findAbsencesOnDate(employeeId, date);
    return absences.length > 0;
  }

  async findAbsencesOnDate(employeeId: string, date: string): Promise<AbsenceRequest[]> {
    if (!employeeId || !date) return [];

    const qb = this.absencesRepository.createQueryBuilder('a');
    qb.where('a.employeeId = :employeeId', { employeeId })
      .andWhere('a.status != :rejected', { rejected: 'rejected' })
      .andWhere('a.startDate <= :date', { date })
      .andWhere('(a.endDate IS NULL OR a.endDate >= :date)', { date })
      .orderBy('a.createdAt', 'DESC');
    return qb.getMany();
  }

  async findBlockingAbsence(
    employeeId: string,
    date: string,
    startTime?: string,
    estimatedDurationMinutes?: number,
  ): Promise<AbsenceRequest | null> {
    if (!employeeId || !date) return null;

    const qb = this.absencesRepository.createQueryBuilder('a');
    qb.where('a.employeeId = :employeeId', { employeeId })
      .andWhere('a.status != :rejected', { rejected: 'rejected' })
      .andWhere('a.startDate <= :date', { date })
      .andWhere('(a.endDate IS NULL OR a.endDate >= :date)', { date })
      .orderBy('a.createdAt', 'DESC');

    const absences = await qb.getMany();
    if (!absences.length) return null;

    if (!startTime || typeof estimatedDurationMinutes !== 'number') {
      return absences[0];
    }

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = startMinutes + estimatedDurationMinutes;

    for (const absence of absences) {
      const intervals = this.getIntervalsForDate(absence, date);
      for (const itv of intervals) {
        if (startMinutes < itv.end && endMinutes > itv.start) return absence;
      }
    }

    return null;
  }

  async getBlockingIntervals(
    employeeId: string,
    date: string,
  ): Promise<Array<{ start: number; end: number; absenceId: string; type: string }>> {
    const absences = await this.findAbsencesOnDate(employeeId, date);
    const intervals: Array<{ start: number; end: number; absenceId: string; type: string }> = [];
    for (const absence of absences) {
      if (absence.status === 'rejected') continue;
      for (const itv of this.getIntervalsForDate(absence, date)) {
        intervals.push({
          start: itv.start,
          end: itv.end,
          absenceId: absence.id,
          type: String(absence.type || ''),
        });
      }
    }
    return intervals;
  }

  private getIntervalsForDate(absence: AbsenceRequest, date: string): Array<{ start: number; end: number }> {
    const startDateStr = this.toDateOnlyString(absence.startDate);
    const endDateStr = this.toDateOnlyString(absence.endDate || absence.startDate);

    if (!startDateStr) return [];
    if (date < startDateStr || date > endDateStr) return [];

    const startMinutes = absence.startTime ? this.timeToMinutes(absence.startTime) : 0;
    const endMinutes = absence.endTime ? this.timeToMinutes(absence.endTime) : 24 * 60;

    if (startDateStr === endDateStr) {
      return [{ start: startMinutes, end: endMinutes }];
    }

    if (date === startDateStr) {
      return [{ start: startMinutes, end: 24 * 60 }];
    }

    if (date === endDateStr) {
      return [{ start: 0, end: endMinutes }];
    }

    return [{ start: 0, end: 24 * 60 }];
  }

  private timeToMinutes(time: string): number {
    const [h, m] = String(time).split(':').map(Number);
    const hours = Number.isFinite(h) ? h : 0;
    const minutes = Number.isFinite(m) ? m : 0;
    return hours * 60 + minutes;
  }

  private toDateOnlyString(value: Date | string): string {
    if (!value) return '';
    if (typeof value === 'string') {
      return value.includes('T') ? value.split('T')[0] : value;
    }
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatPeriod(absence: AbsenceRequest) {
    const startDate = this.toDateOnlyString(absence.startDate);
    const endDate = this.toDateOnlyString(absence.endDate || absence.startDate);
    const startTime = absence.startTime ? String(absence.startTime).slice(0, 5) : '';
    const endTime = absence.endTime ? String(absence.endTime).slice(0, 5) : '';

    if (startDate === endDate) {
      if (startTime || endTime) {
        return `${startDate} ${startTime || '00:00'} - ${endTime || '23:59'}`;
      }
      return startDate;
    }

    return `${startDate} - ${endDate}`;
  }

  private async notifySupervisorIfRoutesAffected(absenceId: string) {
    const absence = await this.findOne(absenceId);
    if (!absence?.employeeId) return;

    const employee = await this.employeesRepository.findOne({ where: { id: absence.employeeId } });
    if (!employee?.supervisorId) return;

    const supervisorUser = await this.usersService.findByEmployeeId(employee.supervisorId);
    if (!supervisorUser?.id) return;

    const todayStr = this.toDateOnlyString(new Date());
    const startDateStr = this.toDateOnlyString(absence.startDate);
    const endDateStr = this.toDateOnlyString(absence.endDate || absence.startDate);
    const rangeStart = startDateStr > todayStr ? startDateStr : todayStr;
    const rangeEnd = endDateStr;

    if (!rangeStart || !rangeEnd || rangeEnd < rangeStart) return;

    const routes = await this.routesRepository.find({
      where: [
        { promoterId: absence.employeeId, date: Between(rangeStart, rangeEnd) as any } as any,
        { promoters: { id: absence.employeeId }, date: Between(rangeStart, rangeEnd) as any } as any,
      ],
      order: { date: 'ASC' } as any,
      relations: ['items'],
    });

    const affectedRoutes = routes.filter(r => {
      const routeDate = String((r as any).date || '').slice(0, 10);
      if (!routeDate) return false;
      const intervals = this.getIntervalsForDate(absence, routeDate);
      if (!intervals.length) return false;

      const hasWholeDay = intervals.some(i => i.start <= 0 && i.end >= 24 * 60);
      if (hasWholeDay) return true;

      const items = Array.isArray((r as any).items) ? (r as any).items : [];
      const timedItems = items.filter((it: any) => it?.startTime && typeof it?.estimatedDuration === 'number');
      if (timedItems.length === 0) return true;

      for (const item of timedItems) {
        const itemStart = this.timeToMinutes(String(item.startTime));
        const itemEnd = itemStart + Number(item.estimatedDuration);
        for (const itv of intervals) {
          if (itemStart < itv.end && itemEnd > itv.start) return true;
        }
      }
      return false;
    });

    if (!affectedRoutes.length) return;

    const typeLabel = String(absence.type || 'ausência');
    const periodLabel = this.formatPeriod(absence);

    await this.notificationsService.create({
      userId: supervisorUser.id,
      title: 'Afastamento/Atestado/Férias registrado',
      message: `${employee.fullName} (${typeLabel}) em ${periodLabel}. Existem ${affectedRoutes.length} rotas agendadas no período que precisam ser ajustadas.`,
      type: 'alert',
      relatedId: absence.id,
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async notifyVacationDeadlines() {
    try {
      const today = new Date();
      const todayStr = this.toDateOnlyString(today);
      const employees = await this.employeesRepository.find({
        where: { status: 'active', contractType: 'clt' } as any,
      });

      if (!employees.length) return;

      const lastVacationsRaw: Array<{ employeeId: string; lastDate: string }> = await this.absencesRepository.query(
        `SELECT "employeeId" as "employeeId", MAX(COALESCE("endDate","startDate")) as "lastDate"
         FROM "absence_requests"
         WHERE "type" ILIKE 'ferias%' AND "status" != 'rejected'
         GROUP BY "employeeId"`,
      );
      const lastByEmployee = new Map<string, string>();
      for (const row of lastVacationsRaw || []) {
        if (row?.employeeId && row?.lastDate) lastByEmployee.set(row.employeeId, String(row.lastDate).slice(0, 10));
      }

      const notifyUsers = await this.usersService.findAdminsAndHR();

      for (const emp of employees) {
        if (!emp?.admissionDate) continue;
        const last = lastByEmployee.get(emp.id);

        const accrualStart = last ? this.addDays(new Date(`${last}T03:00:00.000Z`), 1) : new Date(emp.admissionDate);
        const aquisitiveEnd = this.addMonths(accrualStart, 12);
        const concessiveEnd = this.addMonths(aquisitiveEnd, 12);
        const concessiveEndStr = this.toDateOnlyString(concessiveEnd);

        const daysToConcessiveEnd = this.diffDays(concessiveEnd, today);

        const shouldWarn = daysToConcessiveEnd === 30;
        const shouldDueToday = daysToConcessiveEnd === 0;
        const shouldOverdue = daysToConcessiveEnd === -1;

        if (!shouldWarn && !shouldDueToday && !shouldOverdue) continue;

        const label = shouldOverdue
          ? 'Férias vencidas'
          : shouldDueToday
            ? 'Férias vencem hoje'
            : 'Férias para vencer';

        const message = `${emp.fullName}: prazo concessivo até ${concessiveEndStr}.`;
        const relatedId = `vacation-deadline:${emp.id}:${concessiveEndStr}:${todayStr}`;

        for (const user of notifyUsers || []) {
          if (!user?.id) continue;
          await this.notificationsService.create({
            userId: user.id,
            title: label,
            message,
            type: 'alert',
            relatedId,
          });
        }
      }
    } catch (e) {
      this.logger.error('Failed to notify vacation deadlines', e as any);
    }
  }

  private addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== day) d.setDate(0);
    return d;
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private diffDays(a: Date, b: Date): number {
    const a0 = new Date(a);
    a0.setHours(0, 0, 0, 0);
    const b0 = new Date(b);
    b0.setHours(0, 0, 0, 0);
    return Math.floor((a0.getTime() - b0.getTime()) / (1000 * 60 * 60 * 24));
  }
}
