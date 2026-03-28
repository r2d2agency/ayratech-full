import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from '../entities/contract.entity';
import { Client } from '../entities/client.entity';
import { ContractTemplate } from '../entities/contract-template.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private contractsRepository: Repository<Contract>,
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
    @InjectRepository(ContractTemplate)
    private templatesRepository: Repository<ContractTemplate>,
  ) {}

  async create(createContractDto: CreateContractDto) {
    let content = createContractDto.content;

    // If a template is provided and no custom content is given, generate it
    if (createContractDto.templateId && !content) {
      const template = await this.templatesRepository.findOneBy({ id: createContractDto.templateId });
      const client = await this.clientsRepository.findOneBy({ id: createContractDto.clientId });

      if (template && client) {
        content = this.generateContent(template.content, client);
      }
    }

    const contract = this.contractsRepository.create({
      ...createContractDto,
      content,
    });
    return this.contractsRepository.save(contract);
  }

  generateContent(templateHtml: string, client: Client): string {
    if (!templateHtml) return '';
    let html = templateHtml;
    
    // Replace placeholders
    // This is a simple replacement. For more complex logic, we might need a library or better regex.
    // Assuming placeholders are like {{variable}}
    
    const replacements = {
      '{{razaoSocial}}': client.razaoSocial,
      '{{nomeFantasia}}': client.nomeFantasia,
      '{{cnpj}}': client.cnpj,
      '{{email}}': client.emailPrincipal,
      '{{telefone}}': client.telefonePrincipal,
      '{{endereco}}': `${client.logradouro || ''}, ${client.numero || ''} - ${client.bairro || ''}, ${client.cidade || ''} - ${client.estado || ''}, ${client.cep || ''}`,
      '{{cidade}}': client.cidade,
      '{{estado}}': client.estado,
      '{{dataAtual}}': new Date().toLocaleDateString('pt-BR'),
    };

    for (const [key, value] of Object.entries(replacements)) {
      html = html.split(key).join(value || '');
    }

    return html;
  }

  findAll() {
    return this.contractsRepository.find({ relations: ['client', 'template'] });
  }

  findOne(id: string) {
    return this.contractsRepository.findOne({ 
      where: { id },
      relations: ['client', 'template']
    });
  }

  async update(id: string, updateContractDto: UpdateContractDto) {
    if (Object.keys(updateContractDto).length > 0) {
      await this.contractsRepository.update(id, updateContractDto);
    }
    return this.findOne(id);
  }

  remove(id: string) {
    return this.contractsRepository.delete(id);
  }
}
