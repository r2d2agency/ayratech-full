import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContractTemplatesService } from './contract-templates.service';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';

@Controller('contract-templates')
export class ContractTemplatesController {
  constructor(private readonly contractTemplatesService: ContractTemplatesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('description') description?: string,
  ) {
    return this.contractTemplatesService.createFromDocx(file, name, description);
  }

  @Post()
  create(@Body() createContractTemplateDto: CreateContractTemplateDto) {
    return this.contractTemplatesService.create(createContractTemplateDto);
  }

  @Get()
  findAll() {
    return this.contractTemplatesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractTemplatesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateContractTemplateDto: UpdateContractTemplateDto) {
    return this.contractTemplatesService.update(id, updateContractTemplateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contractTemplatesService.remove(id);
  }
}
