import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Client } from '../entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
  ) {}

  async create(createClientDto: CreateClientDto) {
    if (createClientDto.password) {
      createClientDto.password = await bcrypt.hash(createClientDto.password, 10);
    }
    const client = this.clientsRepository.create(createClientDto);
    return this.clientsRepository.save(client);
  }

  findAll() {
    return this.clientsRepository.find({
      relations: ['brands', 'brands.products', 'supermarkets', 'products']
    });
  }

  findOne(id: string) {
    return this.clientsRepository.findOne({
      where: { id },
      relations: ['brands', 'brands.products', 'supermarkets', 'products']
    });
  }

  async findByEmail(email: string) {
    return this.clientsRepository.findOne({
      where: { emailPrincipal: email },
      select: ['id', 'emailPrincipal', 'password', 'razaoSocial', 'nomeFantasia', 'logo', 'status']
    });
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    if (updateClientDto.password) {
      updateClientDto.password = await bcrypt.hash(updateClientDto.password, 10);
    }
    const { supermarketIds, ...rest } = updateClientDto as any;
    
    // Only perform update if there are fields to update
    if (Object.keys(rest).length > 0) {
      await this.clientsRepository.update(id, rest);
    }

    if (supermarketIds) {
      const client = await this.clientsRepository.findOne({
        where: { id },
        relations: ['supermarkets']
      });
      if (client) {
        client.supermarkets = supermarketIds.map((sid: string) => ({ id: sid } as any));
        await this.clientsRepository.save(client);
      }
    }

    return this.findOne(id);
  }

  remove(id: string) {
    return this.clientsRepository.delete(id);
  }
}
