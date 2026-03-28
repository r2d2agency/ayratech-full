import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, Request, Query, BadRequestException, Res } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UPLOAD_ROOT } from '../config/upload.config';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'rh', 'manager', 'supervisor de operações') // Default allowed roles for employee management
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('facialPhoto', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = join(UPLOAD_ROOT, 'employees');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  create(@Body() createEmployeeDto: CreateEmployeeDto, @UploadedFile() file: Express.Multer.File) {
    console.log('Creating employee with data:', JSON.stringify(createEmployeeDto, null, 2));
    if (file) {
      console.log('Uploaded file:', file.filename);
      createEmployeeDto.facialPhotoUrl = `/uploads/employees/${file.filename}`;
    }
    return this.employeesService.create(createEmployeeDto);
  }

  @Get('documents/all')
  findAllDocuments() {
    return this.employeesService.findAllDocuments();
  }

  @Post('documents/bulk')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = join(UPLOAD_ROOT, 'documents');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  sendBulkDocuments(@Body() data: any, @UploadedFile() file: Express.Multer.File, @Request() req: any) {
    console.log('Received bulk document request:', { data, file: file?.filename, user: req.user });
    
    if (!file && !data.fileUrl) {
      console.error('No file provided for bulk document upload');
    }

    const fileUrl = file ? `/uploads/documents/${file.filename}` : data.fileUrl;
    const senderId = req.user?.userId;

    return this.employeesService.sendBulkDocuments({ 
      ...data, 
      fileUrl,
      senderId
    });
  }

  @Post('location')
  @Roles('admin', 'rh', 'manager', 'supervisor de operações', 'promotor')
  updateLocation(@Body() data: { lat: number; lng: number }, @Request() req: any) {
    // Assuming req.user contains the user info including employeeId
    // If user is just a "User" entity linked to "Employee", we need to find the employee.
    // The JWT strategy usually attaches user object.
    const userId = req.user.userId;
    return this.employeesService.updateLocation(userId, data.lat, data.lng);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('supervisorId') supervisorId?: string,
    @Query('role') role?: string,
  ) {
    return this.employeesService.findAll({ search, supervisorId, role });
  }

  @Get('me/documents')
  @Roles('admin', 'rh', 'manager', 'supervisor de operações', 'promotor', 'promoter', 'app_user')
  findMyDocuments(@Query('search') search: string, @Request() req: any) {
    const employeeId = req.user?.employee?.id;
    if (!employeeId) return [];
    return this.employeesService.findAllDocumentsByEmployee(employeeId, search);
  }

  @Post('me/documents')
  @Roles('admin', 'rh', 'manager', 'supervisor de operações', 'promotor', 'promoter', 'app_user')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = join(UPLOAD_ROOT, 'documents');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  addMyDocument(@Body() data: any, @UploadedFile() file: Express.Multer.File, @Request() req: any) {
    const employeeId = req.user?.employee?.id;
    if (!employeeId) {
      throw new BadRequestException('Usuário sem funcionário vinculado.');
    }

    const fileUrl = file ? `/uploads/documents/${file.filename}` : data.fileUrl;
    const senderId = req.user?.userId;

    return this.employeesService.addDocument({ 
      ...data, 
      employeeId,
      fileUrl,
      senderId
    });
  }

  @Patch('me/documents/:id/sign')
  @Roles('admin', 'rh', 'manager', 'supervisor de operações', 'promotor', 'promoter', 'app_user')
  signMyDocument(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const employeeId = req.user?.employee?.id;
    return this.employeesService.signMyDocument(id, employeeId, body);
  }

  @Post('documents/timesheets/generate')
  generateMonthlyTimesheets(@Body() body: any) {
    return this.employeesService.generateMonthlyTimesheets(body);
  }

  @Post('documents/timesheets/approve')
  approveTimesheets(@Query('competence') competence: string) {
    return this.employeesService.approveTimesheetsAndNotify(competence);
  }

  @Get('documents/timesheets/status-summary')
  getTimesheetsStatusSummary(@Query('competence') competence: string) {
    return this.employeesService.getTimesheetsStatusSummary(competence);
  }

  @Get('documents/timesheets/general/export')
  async exportGeneralTimesheet(@Query('competence') competence: string, @Res() res: Response) {
    const workbook = await this.employeesService.generateGeneralTimesheetWorkbook(competence);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=folha_ponto_geral_${String(competence || '').trim() || 'competencia'}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }

  @Get('vacation-alerts')
  getVacationAlerts() {
    return this.employeesService.getVacationAlerts();
  }

  @Get(':id/documents')
  findAllDocumentsByEmployee(@Param('id') id: string, @Query('search') search?: string) {
    return this.employeesService.findAllDocumentsByEmployee(id, search);
  }

  @Get(':id/vacation-alert')
  getVacationAlert(@Param('id') id: string) {
    return this.employeesService.getVacationAlert(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('facialPhoto', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = join(UPLOAD_ROOT, 'employees');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  update(@Param('id') id: string, @Body() updateEmployeeDto: UpdateEmployeeDto, @UploadedFile() file: Express.Multer.File) {
    console.log(`Updating employee ${id} with data:`, JSON.stringify(updateEmployeeDto, null, 2));
    if (file) {
      console.log('Uploaded file:', file.filename);
      updateEmployeeDto.facialPhotoUrl = `/uploads/employees/${file.filename}`;
    }
    return this.employeesService.update(id, updateEmployeeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }

  @Post(':id/compensation')
  addCompensation(@Param('id') id: string, @Body() data: any) {
    return this.employeesService.addCompensation({ ...data, employeeId: id });
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = join(UPLOAD_ROOT, 'documents');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  addDocument(@Param('id') id: string, @Body() data: any, @UploadedFile() file: Express.Multer.File, @Request() req: any) {
    const fileUrl = file ? `/uploads/documents/${file.filename}` : data.fileUrl;
    
    // req.user is populated by JwtAuthGuard (if used on this route, which it is at controller level)
    const senderId = req.user?.userId;

    return this.employeesService.addDocument({ 
      ...data, 
      employeeId: id,
      fileUrl,
      senderId
    });
  }

  @Patch('documents/:id/read')
  markDocumentAsRead(@Param('id') id: string) {
    return this.employeesService.markDocumentAsRead(id);
  }
}
