import { Controller, Get, Query } from '@nestjs/common';
import { EmployeesService } from './employees.service';

@Controller('employees/public')
export class EmployeesPublicController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('verify-document')
  verifyDocument(@Query('id') id: string, @Query('hash') hash: string) {
    return this.employeesService.verifyDocumentSignature(id, hash);
  }
}

