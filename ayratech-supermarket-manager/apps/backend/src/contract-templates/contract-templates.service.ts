import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as mammoth from 'mammoth';
import { ContractTemplate } from '../entities/contract-template.entity';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';

@Injectable()
export class ContractTemplatesService {
  constructor(
    @InjectRepository(ContractTemplate)
    private contractTemplatesRepository: Repository<ContractTemplate>,
  ) {}

  async createFromDocx(file: Express.Multer.File, name: string, description?: string) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    try {
      const result = await mammoth.convertToHtml({ buffer: file.buffer });
      const html = result.value; // The generated HTML
      // const messages = result.messages; // Any messages, such as warnings during conversion

      const template = this.contractTemplatesRepository.create({
        name,
        description,
        content: html,
        originalFileName: file.originalname,
        status: true
      });
      
      return this.contractTemplatesRepository.save(template);
    } catch (error) {
      throw new BadRequestException('Error converting DOCX file: ' + error.message);
    }
  }

  create(createContractTemplateDto: CreateContractTemplateDto) {
    const template = this.contractTemplatesRepository.create(createContractTemplateDto);
    return this.contractTemplatesRepository.save(template);
  }

  findAll() {
    return this.contractTemplatesRepository.find();
  }

  findOne(id: string) {
    return this.contractTemplatesRepository.findOneBy({ id });
  }

  async update(id: string, updateContractTemplateDto: UpdateContractTemplateDto) {
    if (Object.keys(updateContractTemplateDto).length > 0) {
      await this.contractTemplatesRepository.update(id, updateContractTemplateDto);
    }
    return this.findOne(id);
  }

  remove(id: string) {
    return this.contractTemplatesRepository.delete(id);
  }
}
