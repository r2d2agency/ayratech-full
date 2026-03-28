import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual } from 'typeorm';
import { WorkSchedule } from './entities/work-schedule.entity';
import { WorkScheduleDay } from './entities/work-schedule-day.entity';
import { WorkScheduleException } from './entities/work-schedule-exception.entity';
import { AccessExtension } from './entities/access-extension.entity';
import { Employee } from '../employees/entities/employee.entity';
import { CreateWorkScheduleDto, CreateWorkScheduleExceptionDto } from './dto/create-work-schedule.dto';
import { CreateAccessExtensionDto } from './dto/create-access-extension.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';

@Injectable()
export class WorkSchedulesService {
  constructor(
    @InjectRepository(WorkSchedule)
    private schedulesRepository: Repository<WorkSchedule>,
    @InjectRepository(WorkScheduleDay)
    private daysRepository: Repository<WorkScheduleDay>,
    @InjectRepository(WorkScheduleException)
    private exceptionsRepository: Repository<WorkScheduleException>,
    @InjectRepository(AccessExtension)
    private accessExtensionsRepository: Repository<AccessExtension>,
    @InjectRepository(Employee)
    private employeesRepository: Repository<Employee>,
  ) {}

  async createAccessExtension(dto: CreateAccessExtensionDto, grantedById: string) {
    const extension = this.accessExtensionsRepository.create({
      ...dto,
      grantedById
    });
    return this.accessExtensionsRepository.save(extension);
  }

  async checkAccessStatus(employeeId: string) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR').split('/').reverse().join('-'); // YYYY-MM-DD
    const dayOfWeek = now.getDay(); // 0-6
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    // Find active schedule
    // We get the latest schedule that started before or today
    const schedules = await this.schedulesRepository.find({
      where: {
        employeeId,
        validFrom: LessThanOrEqual(new Date(dateStr) as any),
      },
      relations: ['days'],
      order: { validFrom: 'DESC' },
      take: 1
    });
    
    const schedule = schedules[0];

    // Check if expired
    if (schedule && schedule.validTo) {
       const validToDate = new Date(schedule.validTo);
       const todayDate = new Date(dateStr);
       if (validToDate < todayDate) {
           return { allowed: false, reason: 'schedule_expired' };
       }
    }

    if (!schedule) {
       // No schedule found = assume allowed or blocked? 
       // If strict mode, blocked. But maybe default is allowed for legacy?
       // User said "horario de gestao do app qe precisa ser obedecida".
       // If no schedule, maybe 8-18? Or block.
       // Let's block if no schedule is defined, as it implies "compliance required".
       return { allowed: false, reason: 'no_schedule_defined' };
    }

    const scheduleDay = schedule.days.find(d => d.dayOfWeek === dayOfWeek);

    // Check extension
    const extension = await this.accessExtensionsRepository.findOne({
      where: {
        employeeId,
        date: dateStr
      },
      order: { createdAt: 'DESC' }
    });

    const getMinutes = (t: string) => {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    const currentMin = getMinutes(currentTime);

    // If day is not active (day off)
    if (!scheduleDay || !scheduleDay.active) {
        // If extension exists on day off, allow access up to limit
        if (extension) {
            const endMin = getMinutes(extension.extendedEndTime);
             if (currentMin <= endMin) {
                return { allowed: true, reason: 'extension_day_off', limit: extension.extendedEndTime };
            }
        }
        return { allowed: false, reason: 'day_off' };
    }

    // Normal working day
    const startMin = getMinutes(scheduleDay.startTime);
    let endMin = getMinutes(scheduleDay.endTime);
    const tolerance = scheduleDay.toleranceMinutes || 0;

    // Apply extension
    if (extension && getMinutes(extension.extendedEndTime) > endMin) {
        endMin = getMinutes(extension.extendedEndTime);
    }

    // Logic: Allow access 30 mins before start (for preparation)
    if (currentMin < startMin - 30) {
         return { 
             allowed: false, 
             reason: 'too_early', 
             nextStart: scheduleDay.startTime 
         };
    }

    // Logic: Cut off after End + Tolerance
    if (currentMin > endMin + tolerance) {
         return { 
             allowed: false, 
             reason: 'shift_ended', 
             end: extension ? extension.extendedEndTime : scheduleDay.endTime,
             isExtension: !!extension
         };
    }

    return { 
        allowed: true, 
        schedule: {
            start: scheduleDay.startTime,
            end: scheduleDay.endTime,
            tolerance: scheduleDay.toleranceMinutes
        },
        extension
    };
  }

  async create(createWorkScheduleDto: CreateWorkScheduleDto) {
    console.log('Creating work schedule with payload:', JSON.stringify(createWorkScheduleDto));
    const newStart = new Date(createWorkScheduleDto.validFrom);
    if (isNaN(newStart.getTime())) {
        throw new BadRequestException('Invalid validFrom date');
    }

    // Close previous active schedule
    const previousSchedule = await this.schedulesRepository.findOne({
      where: { 
        employeeId: createWorkScheduleDto.employeeId,
        validTo: IsNull()
      },
      order: { validFrom: 'DESC' }
    });

    if (previousSchedule) {
      // newStart is already validated
      const prevEnd = new Date(newStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      
      await this.schedulesRepository.update(previousSchedule.id, {
        validTo: prevEnd
      });
    }

    const { employeeId, ...scheduleData } = createWorkScheduleDto;

    // Sanitize days to ensure empty strings for time fields become null
    let days = [];
    if (scheduleData.days) {
        days = scheduleData.days.map(day => ({
            ...day,
            active: !!day.active,
            startTime: (day.startTime && day.startTime !== 'null') ? day.startTime : '08:00',
            endTime: (day.endTime && day.endTime !== 'null') ? day.endTime : '17:00',
            breakStart: (day.breakStart && day.breakStart !== 'null') ? day.breakStart : null,
            breakEnd: (day.breakEnd && day.breakEnd !== 'null') ? day.breakEnd : null,
            toleranceMinutes: Number(day.toleranceMinutes) || 0,
        }));
    }
    
    const employee = await this.employeesRepository.findOneBy({ id: employeeId });
    if (!employee) {
        throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    try {
      // Create and save schedule first without days
      const schedule = this.schedulesRepository.create({
        ...scheduleData,
        employeeId, // Explicitly set employeeId
        days: [], // Explicitly empty days
      });
      schedule.employee = employee;
      
      const savedSchedule = await this.schedulesRepository.save(schedule);

      if (!savedSchedule || !savedSchedule.id) {
          throw new Error('Failed to save schedule parent entity');
      }

      // Now create and save days associated with the schedule
      // This avoids cascade issues and ensures proper relation setting
      if (days.length > 0) {
        const daysEntities: WorkScheduleDay[] = days.map(dayData => {
            const day = new WorkScheduleDay();
            day.dayOfWeek = dayData.dayOfWeek;
            day.active = dayData.active;
            day.startTime = dayData.startTime;
            day.endTime = dayData.endTime;
            // Ensure strict null for optional fields
            day.breakStart = (dayData.breakStart && dayData.breakStart !== 'null') ? dayData.breakStart : null;
            day.breakEnd = (dayData.breakEnd && dayData.breakEnd !== 'null') ? dayData.breakEnd : null;
            day.toleranceMinutes = dayData.toleranceMinutes;
            day.workSchedule = savedSchedule;
            return day;
        });
        
        await this.daysRepository.save(daysEntities);
      }
      
      // Re-fetch the schedule with days to return complete object
      return this.schedulesRepository.findOne({ 
          where: { id: savedSchedule.id },
          relations: ['days', 'employee']
      });
    } catch (error) {
        console.error('Detailed Error in WorkSchedulesService.create:', error);
        // Throwing error will be caught by controller
        throw error;
    }
  }

  findAll() {
    return this.schedulesRepository.find({ relations: ['days', 'employee'] });
  }

  findOne(id: string) {
    return this.schedulesRepository.findOne({ where: { id }, relations: ['days', 'employee'] });
  }

  async update(id: string, updateWorkScheduleDto: UpdateWorkScheduleDto) {
    const { days, employeeId, ...scheduleData } = updateWorkScheduleDto;

    // 1. Update parent entity fields if any
    if (Object.keys(scheduleData).length > 0) {
      await this.schedulesRepository.update(id, scheduleData);
    }

    // 2. Update days if provided
    if (days) {
      // Delete existing days
      await this.daysRepository.delete({ workScheduleId: id });

      // Create new days
      const daysEntities: WorkScheduleDay[] = days.map((dayData) => {
        const day = new WorkScheduleDay();
        day.dayOfWeek = dayData.dayOfWeek;
        day.active = !!dayData.active;
        day.startTime =
          dayData.startTime && dayData.startTime !== 'null'
            ? dayData.startTime
            : '08:00';
        day.endTime =
          dayData.endTime && dayData.endTime !== 'null'
            ? dayData.endTime
            : '17:00';
        // Ensure strict null for optional fields
        day.breakStart =
          dayData.breakStart && dayData.breakStart !== 'null'
            ? dayData.breakStart
            : null;
        day.breakEnd =
          dayData.breakEnd && dayData.breakEnd !== 'null'
            ? dayData.breakEnd
            : null;
        day.toleranceMinutes = Number(dayData.toleranceMinutes) || 0;

        // Link to schedule by ID
        day.workSchedule = { id } as WorkSchedule;
        return day;
      });

      await this.daysRepository.save(daysEntities);
    }

    return this.findOne(id);
  }

  remove(id: string) {
    return this.schedulesRepository.delete(id);
  }

  async createException(createExceptionDto: CreateWorkScheduleExceptionDto) {
    const { employeeId, ...exceptionData } = createExceptionDto;

    const employee = await this.employeesRepository.findOneBy({ id: employeeId });
    if (!employee) {
        throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    const exception = this.exceptionsRepository.create({
        ...exceptionData,
    });
    exception.employee = employee;
    return this.exceptionsRepository.save(exception);
  }
}
