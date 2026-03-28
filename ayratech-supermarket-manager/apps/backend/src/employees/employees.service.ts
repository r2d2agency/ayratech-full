import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, ILike } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import { join } from 'path';
import { Employee } from './entities/employee.entity';
import { EmployeeCompensation } from './entities/employee-compensation.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { WorkSchedule } from '../work-schedules/entities/work-schedule.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AbsenceRequest } from '../absences/entities/absence-request.entity';
import { UPLOAD_ROOT } from '../config/upload.config';
import { TimeClockService } from '../time-clock/time-clock.service';
import { createHash } from 'crypto';
import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private employeesRepository: Repository<Employee>,
    @InjectRepository(EmployeeCompensation)
    private compensationRepository: Repository<EmployeeCompensation>,
    @InjectRepository(EmployeeDocument)
    private documentsRepository: Repository<EmployeeDocument>,
    @InjectRepository(WorkSchedule)
    private workScheduleRepository: Repository<WorkSchedule>,
    @InjectRepository(AbsenceRequest)
    private absencesRepository: Repository<AbsenceRequest>,
    private usersService: UsersService,
    private rolesService: RolesService,
    private notificationsService: NotificationsService,
    private timeClockService: TimeClockService,
  ) {}

  async findByCpf(cpf: string): Promise<Employee[]> {
    const clean = cpf.replace(/\D/g, '');
    const formatted = clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    
    return this.employeesRepository.find({ 
        where: [
            { cpf: clean },
            { cpf: formatted }
        ] 
    });
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    // Find employee linked to this user
    const user = await this.usersService.findById(userId);
    if (!user || !user.employee) {
        return;
    }
    
    await this.employeesRepository.update(user.employee.id, {
        lastLatitude: lat,
        lastLongitude: lng,
        lastLocationAt: new Date()
    });
    
    return { success: true };
  }

  async create(createEmployeeDto: CreateEmployeeDto) {
    const { baseSalary, transportVoucher, mealVoucher, createAccess, appPassword, weeklyHours, roleId, supervisorId, ...employeeData } = createEmployeeDto;
    
    // Check if email already exists in employees
    const existingEmployee = await this.employeesRepository.findOne({ where: { email: employeeData.email } });
    if (existingEmployee) {
        throw new BadRequestException('Email já cadastrado para outro funcionário.');
    }

    const employee = this.employeesRepository.create({
      ...employeeData,
      role: roleId ? { id: roleId } : null,
      supervisor: supervisorId ? { id: supervisorId } : null,
    });
    
    let savedEmployee;
    try {
      savedEmployee = await this.employeesRepository.save(employee);
    } catch (error) {
      if (error.code === '23505') { // Unique Violation
          const detail = error.detail || '';
          if (detail.includes('cpf')) {
             throw new BadRequestException('CPF já cadastrado.');
          } else if (detail.includes('email')) {
             throw new BadRequestException('Email já cadastrado.');
          } else if (detail.includes('internalCode') || detail.includes('matricula')) {
             throw new BadRequestException('Matrícula Interna já cadastrada.');
          }
      } else if (error.code === '23503') { // Foreign Key Violation
          const detail = error.detail || '';
          if (detail.includes('roleId')) {
             throw new BadRequestException('Cargo selecionado inválido ou inexistente.');
          } else if (detail.includes('supervisorId')) {
             throw new BadRequestException('Supervisor selecionado inválido ou inexistente.');
          }
      }
      console.error('Error creating employee:', error);
      throw error;
    }

    if (baseSalary) {
      const compensation = this.compensationRepository.create({
        validFrom: new Date(), // Today as start of validity
        remunerationType: 'mensal',
        baseSalary: baseSalary,
        transportVoucher: transportVoucher || 0,
        mealVoucher: mealVoucher || 0
      });
      compensation.employee = savedEmployee;
      await this.compensationRepository.save(compensation);
    }

    if (weeklyHours) {
      // Close previous schedule
      const previousSchedule = await this.workScheduleRepository.findOne({
        where: { 
          employeeId: savedEmployee.id,
          validTo: IsNull()
        },
        order: { validFrom: 'DESC' }
      });

      if (previousSchedule) {
          const newStart = new Date();
          const prevEnd = new Date(newStart);
          prevEnd.setDate(prevEnd.getDate() - 1);
          
          await this.workScheduleRepository.update(previousSchedule.id, {
            validTo: prevEnd
          });
      }

      const schedule = this.workScheduleRepository.create({
        validFrom: new Date(),
        weeklyHours: weeklyHours,
        timezone: 'America/Sao_Paulo'
      });
      schedule.employee = savedEmployee;
      await this.workScheduleRepository.save(schedule);
    }

    // Handle User Creation for App Access
    if (createAccess === 'true' || createAccess === '1' || createAccess === 'on') {
        try {
            // Find 'promotor' role
            const allRoles = await this.rolesService.findAll();
            const promoterRole = allRoles.find(r => 
                r.name.toLowerCase() === 'promotor' || 
                r.name.toLowerCase() === 'promoter' || 
                r.name.toLowerCase() === 'app_user'
            );

            if (!promoterRole) {
                console.warn('Role "promotor" not found. Skipping user creation.');
            } else {
                // Check if user exists
                const existingUser = await this.usersService.findOne(savedEmployee.email);
                if (!existingUser) {
                    await this.usersService.create({
                        email: savedEmployee.email,
                        password: appPassword || 'mudar123',
                        roleId: promoterRole.id,
                        employeeId: savedEmployee.id,
                        status: 'active'
                    });
                    console.log(`User created for employee ${savedEmployee.email}`);
                }
            }
        } catch (error) {
            console.error('Error creating user for employee:', error);
            // Don't fail the request, just log it
        }
    }

    return savedEmployee;
  }

  async findAll(filters?: { search?: string; supervisorId?: string; role?: string }) {
    const where: any = {};
    const search = filters?.search;
    if (search) {
      where.fullName = ILike(`%${search}%`);
    }

    if (filters?.supervisorId) {
      where.supervisorId = filters.supervisorId;
    }

    const employees = await this.employeesRepository.find({
      where,
      relations: ['role', 'supervisor'],
      order: { fullName: 'ASC' },
      take: search ? 50 : undefined,
    });
    
    // Populate appAccessEnabled for all employees
    // This is not the most efficient way (N+1), but works for now. 
    // Optimization: Fetch all users with employeeId once.
    const users = await this.usersService.findAll(); // Assuming findAll exists and returns all users
    const userEmployeeIds = new Set(users.map(u => u.employee?.id || u.employeeId).filter(id => !!id));

    const roleFilter = (filters?.role || '').toLowerCase().trim();
    const filtered = roleFilter
      ? employees.filter(emp => {
          const roleName = (emp as any).role?.name?.toLowerCase?.() || '';
          if (roleFilter === 'promotor' || roleFilter === 'promoter') {
            return roleName.includes('promotor') || roleName.includes('promoter') || roleName.includes('app_user');
          }
          return roleName.includes(roleFilter);
        })
      : employees;

    return filtered.map(emp => ({
      ...emp,
      appAccessEnabled: userEmployeeIds.has(emp.id),
    }));
  }

  async findOne(id: string) {
    try {
      const employee = await this.employeesRepository.findOne({ 
        where: { id }, 
        relations: ['role', 'supervisor', 'compensations', 'workSchedules', 'workSchedules.days', 'subordinates'] 
      });

      if (employee) {
        const user = await this.usersService.findByEmployeeId(employee.id);
        (employee as any).appAccessEnabled = !!user;
      }

      return employee;
    } catch (error) {
      console.error(`Error finding employee ${id}:`, error);
      throw new BadRequestException(`Erro ao buscar funcionário: ${error.message}`);
    }
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    const { 
      baseSalary, hourlyRate, dailyRate, visitRate, monthlyAllowance, 
      transportVoucher, mealVoucher, chargesPercentage,
      weeklyHours, createAccess, appPassword, roleId, supervisorId, 
      ...employeeData 
    } = updateEmployeeDto;

    // Update basic info if there are fields to update
    const updatePayload: any = { ...employeeData };
    if (roleId !== undefined) updatePayload.role = roleId ? { id: roleId } : null;
    if (supervisorId !== undefined) updatePayload.supervisor = supervisorId ? { id: supervisorId } : null;

    if (Object.keys(updatePayload).length > 0) {
      await this.employeesRepository.save({ id, ...updatePayload });
    }

    const employee = await this.findOne(id);
    if (!employee) return null;

    // Handle Compensation
    if (baseSalary !== undefined || hourlyRate !== undefined || dailyRate !== undefined || 
        visitRate !== undefined || monthlyAllowance !== undefined || 
        transportVoucher !== undefined || mealVoucher !== undefined || 
        chargesPercentage !== undefined) {
      const compensations = employee.compensations || [];
      const currentComp = compensations.sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())[0];

      const newSalary = baseSalary !== undefined ? baseSalary : currentComp?.baseSalary;
      const newHourly = hourlyRate !== undefined ? hourlyRate : currentComp?.hourlyRate;
      const newDaily = dailyRate !== undefined ? dailyRate : currentComp?.dailyRate;
      const newVisit = visitRate !== undefined ? visitRate : currentComp?.visitRate;
      const newAllowance = monthlyAllowance !== undefined ? monthlyAllowance : currentComp?.monthlyAllowance;
      const newTransport = transportVoucher !== undefined ? transportVoucher : currentComp?.transportVoucher;
      const newMeal = mealVoucher !== undefined ? mealVoucher : currentComp?.mealVoucher;
      const newCharges = chargesPercentage !== undefined ? chargesPercentage : currentComp?.chargesPercentage;

      // Check if anything changed
      const isDifferent = !currentComp || 
        Number(currentComp.baseSalary) !== Number(newSalary) || 
        Number(currentComp.hourlyRate) !== Number(newHourly) || 
        Number(currentComp.dailyRate) !== Number(newDaily) || 
        Number(currentComp.visitRate) !== Number(newVisit) || 
        Number(currentComp.monthlyAllowance) !== Number(newAllowance) || 
        Number(currentComp.transportVoucher) !== Number(newTransport) || 
        Number(currentComp.mealVoucher) !== Number(newMeal) ||
        Number(currentComp.chargesPercentage) !== Number(newCharges);

      if (isDifferent) {
        const compensation = this.compensationRepository.create({
          validFrom: new Date(),
          remunerationType: 'mensal',
          baseSalary: newSalary || 0,
          hourlyRate: newHourly || 0,
          dailyRate: newDaily || 0,
          visitRate: newVisit || 0,
          monthlyAllowance: newAllowance || 0,
          transportVoucher: newTransport || 0,
          mealVoucher: newMeal || 0,
          chargesPercentage: newCharges || 0
        });
        compensation.employee = employee;
        await this.compensationRepository.save(compensation);
      }
    }

    // Handle Schedule
    if (weeklyHours !== undefined) {
      const schedules = employee.workSchedules || [];
      const currentSchedule = schedules.sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())[0];
      
      const isDifferent = !currentSchedule || Number(currentSchedule.weeklyHours) !== Number(weeklyHours);

      if (isDifferent) {
        // Close previous schedule
        if (currentSchedule && !currentSchedule.validTo) {
             const newStart = new Date();
             const prevEnd = new Date(newStart);
             prevEnd.setDate(prevEnd.getDate() - 1);
             
             await this.workScheduleRepository.update(currentSchedule.id, {
               validTo: prevEnd
             });
        }

        const schedule = this.workScheduleRepository.create({
          validFrom: new Date(),
          weeklyHours: weeklyHours,
          timezone: 'America/Sao_Paulo'
        });
        schedule.employee = employee;
        await this.workScheduleRepository.save(schedule);
      }
    }

    // Handle App Access (User creation/update)
    // Only proceed if createAccess is present in the update payload
    if (createAccess !== undefined) {
      // createAccess might be 'true' string or boolean
      const shouldHaveAccess = String(createAccess) === 'true' || createAccess === 'on';
      const hasUser = (employee as any).appAccessEnabled;

      if (shouldHaveAccess && !hasUser) {
          // Check if user exists with this email
          const existingUser = await this.usersService.findOne(employee.email);
          
          const allRoles = await this.rolesService.findAll();
          let promoterRole = allRoles.find(r => 
              r.name.toLowerCase() === 'promotor' || 
              r.name.toLowerCase() === 'promoter' || 
              r.name.toLowerCase() === 'app_user'
          );

          if (!promoterRole) {
             console.log('Promoter role not found, creating it...');
             try {
                 promoterRole = await this.rolesService.create({
                     name: 'Promotor',
                     description: 'Acesso básico ao aplicativo móvel',
                     accessLevel: 'basic',
                     permissions: []
                 });
             } catch (err) {
                 console.error('Failed to create Promoter role:', err);
                 throw new BadRequestException('Não foi possível criar o perfil de acesso Promotor.');
             }
          }

          if (existingUser) {
              // Check if any OTHER user is already linked to this employee (to avoid unique constraint violation)
              const userLinkedToEmployee = await this.usersService.findByEmployeeId(employee.id);
              if (userLinkedToEmployee && userLinkedToEmployee.id !== existingUser.id) {
                  // Unlink the other user
                  console.warn(`Unlinking employee ${employee.id} from previous user ${userLinkedToEmployee.email}`);
                  await this.usersService.update(userLinkedToEmployee.id, { employeeId: null as any });
              }

              // User exists but not linked to this employee (otherwise hasUser would be true)
              if (!existingUser.employee || !existingUser.employee.id || existingUser.employee.id !== employee.id) {
                  // Link existing user to this employee
                  try {
                      await this.usersService.update(existingUser.id, {
                          employeeId: employee.id,
                          roleId: promoterRole.id, // Ensure they have the right role
                          status: 'active'
                      });
                  } catch (e) {
                      console.error('Error linking user to employee:', e);
                      throw new BadRequestException(`Erro ao vincular usuário: ${e.message}`);
                  }
              } else {
                  console.error(`User with email ${employee.email} is already linked to another employee`);
                  // IMPORTANT: Throw error so frontend knows it failed
                  throw new BadRequestException(`O email ${employee.email} já está vinculado a outro funcionário.`);
              }
          } else {
              // Create User
              // Check if any OTHER user is already linked to this employee
              const userLinkedToEmployee = await this.usersService.findByEmployeeId(employee.id);
              if (userLinkedToEmployee) {
                  // Unlink the other user
                  console.warn(`Unlinking employee ${employee.id} from previous user ${userLinkedToEmployee.email}`);
                  try {
                      await this.usersService.update(userLinkedToEmployee.id, { employeeId: null as any });
                  } catch (e) {
                      console.error('Error unlinking user:', e);
                  }
              }

              try {
                  await this.usersService.create({
                      email: employee.email,
                      password: appPassword || 'mudar123',
                      roleId: promoterRole.id,
                      employeeId: employee.id,
                      status: 'active'
                  });
              } catch (e) {
                  console.error('Error creating user on update:', e);
                  throw new BadRequestException(`Erro ao criar usuário: ${e.message}`);
              }
          }
      } else if (!shouldHaveAccess && hasUser) {
          // Deactivate User and Unlink Employee (instead of deleting to preserve history)
          const user = await this.usersService.findByEmployeeId(id);
          if (user) {
              try {
                  await this.usersService.update(user.id, { 
                       employeeId: null as any,
                       status: 'inactive'
                   });
              } catch (e) {
                  console.error('Error deactivating user:', e);
                  throw new BadRequestException(`Erro ao desativar acesso: ${e.message}`);
              }
          }
      } else if (shouldHaveAccess && hasUser) {
          // Ensure user is active and Update Password if provided
          const user = await this.usersService.findByEmployeeId(id);
          if (user) {
              try {
                  const updateData: any = { status: 'active' };
                  if (appPassword) {
                      updateData.password = appPassword;
                  }
                  await this.usersService.update(user.id, updateData);
              } catch (e) {
                  console.error('Error updating user status/password:', e);
                  throw new BadRequestException(`Erro ao atualizar usuário: ${e.message}`);
              }
          }
      }
    }

    return this.findOne(id);
  }

  remove(id: string) {
    return this.employeesRepository.delete(id);
  }

  // Methods for compensation and documents could be added here or in separate services
  async addCompensation(data: any) {
    const employee = await this.employeesRepository.findOneBy({ id: data.employeeId });
    if (!employee) {
        throw new NotFoundException(`Employee with ID ${data.employeeId} not found`);
    }

    const compensation = this.compensationRepository.create({
      ...data,
    } as unknown as EmployeeCompensation);
    compensation.employee = employee;
    return this.compensationRepository.save(compensation);
  }

  async findAllDocuments() {
    return this.documentsRepository.find({
      relations: ['employee', 'sender', 'sender.employee'],
      order: { sentAt: 'DESC' }
    });
  }

  async findAllDocumentsByEmployee(employeeId: string, search?: string) {
    const qb = this.documentsRepository.createQueryBuilder('doc')
      .leftJoinAndSelect('doc.sender', 'sender')
      .leftJoinAndSelect('sender.employee', 'senderEmployee')
      .where('doc.employeeId = :employeeId', { employeeId })
      .orderBy('doc.sentAt', 'DESC')
      .addOrderBy('doc.createdAt', 'DESC');

    const q = String(search || '').trim();
    if (q) {
      qb.andWhere(
        '(doc.type ILIKE :q OR doc.description ILIKE :q OR doc.fileUrl ILIKE :q OR sender.email ILIKE :q OR senderEmployee.fullName ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    return qb.getMany();
  }

  async getVacationAlert(employeeId: string) {
    const employee = await this.employeesRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('Funcionário não encontrado');
    }
    if (employee.contractType !== 'clt' || !employee.admissionDate) {
      return { applicable: false };
    }

    const lastRow = await this.absencesRepository.query(
      `SELECT MAX(COALESCE("endDate","startDate")) as "lastDate"
       FROM "absence_requests"
       WHERE "employeeId" = $1 AND "type" ILIKE 'ferias%' AND "status" != 'rejected'`,
      [employeeId],
    );
    const last = (lastRow && lastRow[0] && lastRow[0].lastDate) ? String(lastRow[0].lastDate).slice(0, 10) : null;

    const accrualStart = last ? this.addDays(new Date(`${last}T03:00:00.000Z`), 1) : new Date(employee.admissionDate);
    const aquisitiveEnd = this.addMonths(accrualStart, 12);
    const concessiveEnd = this.addMonths(aquisitiveEnd, 12);
    const concessiveEndStr = this.toDateOnlyString(concessiveEnd);

    const today = new Date();
    const daysToConcessiveEnd = this.diffDays(concessiveEnd, today);

    let level: 'ok' | 'warning' | 'due' | 'expired' = 'ok';
    if (daysToConcessiveEnd < 0) level = 'expired';
    else if (daysToConcessiveEnd === 0) level = 'due';
    else if (daysToConcessiveEnd <= 30) level = 'warning';

    const label =
      level === 'expired'
        ? 'Férias vencidas'
        : level === 'due'
        ? 'Férias vencem hoje'
        : level === 'warning'
        ? 'Férias para vencer'
        : 'Sem alertas';

    return {
      applicable: true,
      level,
      label,
      concessiveEnd: concessiveEndStr,
      daysToExpire: daysToConcessiveEnd,
    };
  }

  async getVacationAlerts() {
    const employees = await this.employeesRepository.find();
    const alerts = [];
    for (const emp of employees) {
      try {
        const alert = await this.getVacationAlert(emp.id);
        if (alert.applicable && alert.level !== 'ok') {
          alerts.push({ employee: emp, ...alert });
        }
      } catch (e) {
        // ignore
      }
    }
    return alerts;
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

  private toDateOnlyString(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async addDocument(data: any) {
    if (!data.employeeId) {
        throw new BadRequestException('ID do funcionário é obrigatório.');
    }
    if (!data.type) {
        throw new BadRequestException('Tipo do documento é obrigatório.');
    }
    if (!data.fileUrl) {
        throw new BadRequestException('Arquivo do documento é obrigatório.');
    }

    const employee = await this.employeesRepository.findOneBy({ id: data.employeeId });
    if (!employee) {
        throw new NotFoundException(`Employee with ID ${data.employeeId} not found`);
    }

    const document = this.documentsRepository.create({
      ...data,
      employeeId: employee.id,
      sentAt: new Date()
    } as unknown as EmployeeDocument);
    document.employee = employee;

    let savedDoc;
    try {
        savedDoc = await this.documentsRepository.save(document);
    } catch (error) {
        console.error('Error saving document:', error);
        throw new BadRequestException(`Erro ao salvar documento: ${error.message}`);
    }

    // Notify logic
    try {
      // If sender is the employee (or undefined, assuming app upload), notify Admins/HR
      // If sender is someone else (Admin/HR), notify the Employee
      const senderIsEmployee = data.senderId ? 
           (await this.usersService.findById(data.senderId))?.employee?.id === data.employeeId 
           : true; // Default to true if no senderId (app upload)

      if (senderIsEmployee) {
          // Notify Admins/HR
          const admins = await this.usersService.findAdminsAndHR();
          for (const admin of admins) {
              await this.notificationsService.create({
                  userId: admin.id,
                  title: 'Novo Documento de Funcionário',
                  message: `O funcionário ${employee.fullName} enviou um documento: ${data.type} - ${data.description || ''}`,
                  type: 'document_received',
                  relatedId: (savedDoc as any).id
              });
          }
      } else {
          // Notify Employee (User)
          // For folha_ponto pending validation, do not notify employee yet
          const isPendingFolha = document.type === 'folha_ponto' && (document as any).approvalStatus !== 'validated';
          if (!isPendingFolha) {
            const user = await this.usersService.findByEmployeeId(data.employeeId);
            if (user && user.id !== data.senderId) {
              await this.notificationsService.create({
                userId: user.id,
                title: 'Novo Documento Recebido',
                message: `Você recebeu um novo documento: ${data.type} - ${data.description || ''}`,
                type: 'document',
                relatedId: (savedDoc as any).id
              });
            }
          }
      }
    } catch (e) {
      console.error('Error notifying about document:', e);
    }

    return savedDoc;
  }

  private ensureDocumentsDir() {
    const dir = join(UPLOAD_ROOT, 'documents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private sanitizeFileSegment(value: string) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
  }

  private async persistWorkbookToDocuments(workbook: any, filename: string) {
    const dir = this.ensureDocumentsDir();
    const safeName = this.sanitizeFileSegment(filename) || `document_${Date.now()}.xlsx`;
    const filePath = join(dir, safeName);
    await workbook.xlsx.writeFile(filePath);
    return `/uploads/documents/${safeName}`;
  }

  async addSystemDocument(data: any) {
    if (!data.employeeId) {
      throw new BadRequestException('ID do funcionário é obrigatório.');
    }
    if (!data.type) {
      throw new BadRequestException('Tipo do documento é obrigatório.');
    }
    if (!data.fileUrl) {
      throw new BadRequestException('Arquivo do documento é obrigatório.');
    }

    const employee = await this.employeesRepository.findOneBy({ id: data.employeeId });
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${data.employeeId} not found`);
    }

    const document = this.documentsRepository.create({
      ...data,
      employeeId: employee.id,
      sentAt: new Date(),
    } as unknown as EmployeeDocument);
    document.employee = employee;

    const savedDoc = await this.documentsRepository.save(document);

    try {
      const user = await this.usersService.findByEmployeeId(data.employeeId);
      if (user) {
        await this.notificationsService.create({
          userId: user.id,
          title: 'Novo Documento Recebido',
          message: `Você recebeu um novo documento: ${data.type}${data.competence ? ` (${data.competence})` : ''}.`,
          type: 'document',
          relatedId: savedDoc.id,
        });
      }
    } catch (e) {
      console.error('Error notifying about system document:', e);
    }

    return savedDoc;
  }

  async signMyDocument(documentId: string, employeeId: string, signedMeta?: any) {
    if (!employeeId) throw new BadRequestException('Usuário sem funcionário vinculado.');

    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
      relations: ['employee'],
    });

    if (!document) throw new BadRequestException('Document not found');
    if (document.employeeId !== employeeId) throw new BadRequestException('Documento não pertence ao usuário.');
    if (!document.requiresSignature) throw new BadRequestException('Documento não requer assinatura.');
    if (document.signedAt) return document;

    const dir = this.ensureDocumentsDir();
    const docPath = document.fileUrl.startsWith('/uploads/') ? document.fileUrl.replace('/uploads/', '') : document.fileUrl;
    const absPath = join(UPLOAD_ROOT, docPath);
    let docHash = '';
    try {
      const buf = await fs.promises.readFile(absPath);
      const hash = createHash('sha256').update(buf).digest('hex');
      docHash = hash;
    } catch (e) {
      console.warn('Could not hash original file:', e);
    }

    const timestamp = new Date().toISOString();
    const payload = {
      documentId,
      employeeId,
      timestamp: signedMeta?.timestamp || timestamp,
      signer: signedMeta?.signer || null,
      location: signedMeta?.location || null,
      device: signedMeta?.device || null,
      docHash,
    };
    const signatureHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    let qrDataUrl = '';
    try {
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
      const verifyUrl = `${baseUrl}/employees/public/verify-document?id=${encodeURIComponent(documentId)}&hash=${encodeURIComponent(signatureHash)}`;
      qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 4 });
    } catch (e) {
      console.warn('QR generation failed:', e);
    }

    let signedFileUrl: string | undefined;
    try {
      const pdfBytes = await this.generateSignaturePdf({
        employeeName: document.employee.fullName,
        competence: document.competence,
        signatureImageDataUrl: signedMeta?.signatureImage,
        signatureHash,
        qrDataUrl,
        signedAt: payload.timestamp,
        docType: document.type,
      });
      const nameSeg = this.sanitizeFileSegment(`${document.type}_${document.competence || ''}_${document.employee.fullName}_${document.employeeId}`) || document.id;
      const pdfName = `${nameSeg}_assinado.pdf`;
      const outPath = join(dir, pdfName);
      await fs.promises.writeFile(outPath, pdfBytes);
      signedFileUrl = `/uploads/documents/${pdfName}`;
    } catch (e) {
      console.error('Failed to generate signed PDF:', e);
    }

    document.signedAt = new Date();
    document.signedByEmployeeId = employeeId;
    document.signedMeta = { ...(signedMeta || {}), hash: signatureHash, docHash, qrDataUrl };
    if (signedFileUrl) document.signedFileUrl = signedFileUrl;
    if (!document.readAt) document.readAt = new Date();

    const saved = await this.documentsRepository.save(document);

    try {
      const admins = await this.usersService.findAdminsAndHR();
      for (const admin of admins) {
        await this.notificationsService.create({
          userId: admin.id,
          title: 'Documento Assinado',
          message: `${document.employee.fullName} assinou o documento: ${document.type}${document.competence ? ` (${document.competence})` : ''}.`,
          type: 'info',
          relatedId: document.id,
        });
      }
    } catch (e) {
      console.error('Error notifying HR about signature:', e);
    }

    return saved;
  }

  private async generateSignaturePdf(opts: {
    employeeName: string;
    competence?: string | null;
    signatureImageDataUrl?: string | null;
    signatureHash: string;
    qrDataUrl?: string | null;
    signedAt: string;
    docType: string;
  }): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
    const { width, height } = page.getSize();

    const title = `${opts.docType === 'folha_ponto' ? 'Folha de Ponto' : 'Documento'} ${opts.competence ? `(${opts.competence})` : ''}`;
    page.drawText(title, { x: 40, y: height - 60, size: 18, font: await pdfDoc.embedFont(StandardFonts.HelveticaBold) });
    page.drawText(opts.employeeName || '', { x: 40, y: height - 90, size: 12, font: await pdfDoc.embedFont(StandardFonts.Helvetica) });

    // Signature area
    const sigY = 140;
    page.drawText('Assinatura do Colaborador:', { x: 40, y: sigY + 60, size: 11, font: await pdfDoc.embedFont(StandardFonts.Helvetica) });
    page.drawRectangle({ x: 40, y: sigY, width: width - 80 - 150, height: 50, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });

    if (opts.signatureImageDataUrl && opts.signatureImageDataUrl.startsWith('data:image')) {
      const imgBytes = Buffer.from(opts.signatureImageDataUrl.split(',')[1], 'base64');
      let image;
      if (opts.signatureImageDataUrl.includes('image/png')) {
        image = await pdfDoc.embedPng(imgBytes);
      } else {
        image = await pdfDoc.embedJpg(imgBytes);
      }
      const imgWidth = Math.min(image.width, width - 100 - 150);
      const scale = (width - 100 - 150) / image.width;
      page.drawImage(image, {
        x: 45,
        y: sigY + 5,
        width: imgWidth * scale,
        height: image.height * scale,
      });
    }

    // Stamp box with hash and QR
    const stampX = width - 150;
    const stampY = 100;
    page.drawRectangle({ x: stampX - 10, y: stampY - 10, width: 140, height: 140, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
    page.drawText('Carimbo Digital', { x: stampX, y: stampY + 115, size: 10, font: await pdfDoc.embedFont(StandardFonts.HelveticaBold) });
    page.drawText(`Assinado: ${opts.signedAt}`, { x: stampX, y: stampY + 100, size: 8, font: await pdfDoc.embedFont(StandardFonts.Helvetica) });
    page.drawText(`Hash: ${opts.signatureHash.slice(0, 16)}...`, { x: stampX, y: stampY + 88, size: 8, font: await pdfDoc.embedFont(StandardFonts.Helvetica) });

    if (opts.qrDataUrl && opts.qrDataUrl.startsWith('data:image')) {
      const qrBytes = Buffer.from(opts.qrDataUrl.split(',')[1], 'base64');
      const qrImg = await pdfDoc.embedPng(qrBytes);
      page.drawImage(qrImg, { x: stampX, y: stampY, width: 120, height: 120 });
    }

    return pdfDoc.save();
  }

  async approveTimesheetsAndNotify(competence: string) {
    const comp = String(competence || '').trim();
    if (!comp) throw new BadRequestException('Competência é obrigatória (YYYY-MM).');
    const docs = await this.documentsRepository.find({ where: { type: 'folha_ponto', competence: comp, approvalStatus: 'pending' as any } });
    for (const doc of docs) {
      (doc as any).approvalStatus = 'validated';
      await this.documentsRepository.save(doc);
      try {
        const user = await this.usersService.findByEmployeeId(doc.employeeId);
        if (user) {
          await this.notificationsService.create({
            userId: user.id,
            title: 'Folha de Ponto Disponível',
            message: `Sua folha de ponto ${doc.competence} foi validada pelo RH e está disponível para assinatura.`,
            type: 'document',
            relatedId: doc.id
          });
        }
      } catch (e) {
        console.error('Notify on approval failed:', e);
      }
    }
    return { affected: docs.length };
  }

  async verifyDocumentSignature(id: string, hash: string) {
    const doc = await this.documentsRepository.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    const ok = !!doc.signedMeta?.hash && String(doc.signedMeta.hash) === String(hash);
    return {
      id: doc.id,
      type: doc.type,
      competence: doc.competence,
      employeeId: doc.employeeId,
      signedAt: doc.signedAt,
      valid: ok,
      hash: doc.signedMeta?.hash || null,
      docHash: doc.signedMeta?.docHash || null,
      signedFileUrl: doc.signedFileUrl || null,
    };
  }

  async getTimesheetsStatusSummary(competence: string) {
    const comp = String(competence || '').trim();
    if (!comp) throw new BadRequestException('Competência é obrigatória (YYYY-MM).');

    const rows = await this.documentsRepository
      .createQueryBuilder('doc')
      .select("COALESCE(doc.approvalStatus, 'pending')", 'status')
      .addSelect('COUNT(*)', 'count')
      .where('doc.type = :type', { type: 'folha_ponto' })
      .andWhere('doc.competence = :competence', { competence: comp })
      .groupBy('status')
      .getRawMany<{ status: 'pending' | 'validated'; count: string }>();

    const pending = Number(rows.find(r => r.status === 'pending')?.count || 0);
    const validated = Number(rows.find(r => r.status === 'validated')?.count || 0);

    const signed = await this.documentsRepository
      .createQueryBuilder('doc')
      .where('doc.type = :type', { type: 'folha_ponto' })
      .andWhere('doc.competence = :competence', { competence: comp })
      .andWhere('doc.signedAt IS NOT NULL')
      .getCount();

    const validatedUnsigned = await this.documentsRepository
      .createQueryBuilder('doc')
      .where('doc.type = :type', { type: 'folha_ponto' })
      .andWhere('doc.competence = :competence', { competence: comp })
      .andWhere("COALESCE(doc.approvalStatus, 'pending') = 'validated'")
      .andWhere('doc.signedAt IS NULL')
      .getCount();

    return { competence: comp, pending, validated, signed, validatedUnsigned };
  }

  async generateMonthlyTimesheets(body: {
    competence: string;
    employeeIds?: string[];
    sendToAll?: boolean;
    skipIfExists?: boolean;
  }) {
    const competence = String(body?.competence || '').trim();
    if (!competence) throw new BadRequestException('Competência é obrigatória (YYYY-MM).');

    const skipIfExists = body?.skipIfExists !== false;

    let employeeIds: string[] = Array.isArray(body?.employeeIds) ? body.employeeIds.filter(Boolean) : [];
    if (body?.sendToAll || employeeIds.length === 0) {
      const employees = await this.employeesRepository.find({
        where: [{ status: 'active' }, { status: 'afastado' }],
      });
      employeeIds = employees.map(e => e.id);
    }

    const created: EmployeeDocument[] = [];
    for (const employeeId of employeeIds) {
      if (skipIfExists) {
        const exists = await this.documentsRepository.findOne({
          where: { employeeId, type: 'folha_ponto', competence },
        });
        if (exists) continue;
      }

      const workbook = await this.timeClockService.generateEmployeeTimesheetWorkbook(competence, employeeId);
      const employee = await this.employeesRepository.findOne({ where: { id: employeeId } });
      const employeeSeg = this.sanitizeFileSegment(employee?.fullName || employeeId);
      const filename = `folha_ponto_${competence}_${employeeSeg}_${employeeId}.xlsx`;
      const fileUrl = await this.persistWorkbookToDocuments(workbook, filename);

      const doc = await this.addSystemDocument({
        employeeId,
        type: 'folha_ponto',
        competence,
        fileUrl,
        description: `Folha de ponto ${competence}`,
        requiresSignature: true,
      });

      created.push(doc);
    }

    return { created, affected: created.length };
  }

  async generateGeneralTimesheetWorkbook(competence: string) {
    return this.timeClockService.generateGeneralTimesheetWorkbook(competence);
  }

  @Cron('0 0 6 * * *')
  async autoGenerateMonthlyTimesheets() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    while (first.getDay() === 0 || first.getDay() === 6) {
      first.setDate(first.getDate() + 1);
    }

    const sameDay =
      now.getFullYear() === first.getFullYear() &&
      now.getMonth() === first.getMonth() &&
      now.getDate() === first.getDate();

    if (!sameDay) return;

    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const competence = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

    try {
      await this.generateMonthlyTimesheets({ competence, sendToAll: true, skipIfExists: true });
    } catch (e) {
      console.error('autoGenerateMonthlyTimesheets error:', e);
    }
  }

  async markDocumentAsRead(documentId: string) {
    const document = await this.documentsRepository.findOne({
      where: { id: documentId },
      relations: ['employee']
    });

    if (!document) {
      throw new BadRequestException('Document not found');
    }

    if (document.readAt) {
      return document; // Already read
    }

    document.readAt = new Date();
    await this.documentsRepository.save(document);

    // Notify Sender (Admin/RH) if senderId exists
    if (document.senderId) {
      await this.notificationsService.create({
        userId: document.senderId,
        title: 'Documento Visualizado',
        message: `${document.employee.fullName} visualizou o documento: ${document.type}`,
        type: 'info',
        relatedId: document.id
      });
    }

    return document;
  }

  async sendBulkDocuments(data: any) {
    console.log('Processing bulk documents for:', data);
    let targetEmployeeIds: string[] = [];

    if (data.sendToAll === true || data.sendToAll === 'true') {
        const allEmployees = await this.employeesRepository.find();
        targetEmployeeIds = allEmployees.map(e => e.id);
        console.log(`Sending to all ${targetEmployeeIds.length} employees`);
    } else {
        if (typeof data.employeeIds === 'string') {
            // Check if it's a comma-separated string
            if (data.employeeIds.includes(',')) {
                targetEmployeeIds = data.employeeIds.split(',').map(id => id.trim());
            } else {
                try {
                    // Try to parse if it's a JSON array string
                    const parsed = JSON.parse(data.employeeIds);
                    targetEmployeeIds = Array.isArray(parsed) ? parsed : [data.employeeIds];
                } catch {
                    // If not JSON, assume single ID string
                    targetEmployeeIds = [data.employeeIds];
                }
            }
        } else if (Array.isArray(data.employeeIds)) {
            targetEmployeeIds = data.employeeIds;
        }
    }

    // Filter unique IDs and remove empty ones
    targetEmployeeIds = [...new Set(targetEmployeeIds)].filter(id => id);
    console.log('Target Employee IDs:', targetEmployeeIds);

    if (targetEmployeeIds.length === 0) {
        console.warn('No target employees found/selected');
        throw new BadRequestException('Nenhum funcionário selecionado.');
    }

    const results = [];
    for (const empId of targetEmployeeIds) {
        try {
            const doc = await this.addDocument({
                ...data,
                employeeId: empId
            });
            results.push({ status: 'success', employeeId: empId, documentId: doc.id });
        } catch (err) {
            console.error(`Failed to send document to employee ${empId}:`, err);
            results.push({ status: 'error', employeeId: empId, error: err.message });
        }
    }
    console.log('Bulk send results:', results);
    return results;
  }
}
