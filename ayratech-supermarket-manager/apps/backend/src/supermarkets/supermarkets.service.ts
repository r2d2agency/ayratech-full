import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supermarket } from '../entities/supermarket.entity';
import { CreateSupermarketDto } from './dto/create-supermarket.dto';
import { UpdateSupermarketDto } from './dto/update-supermarket.dto';
import { SupermarketGroup } from '../supermarket-groups/entities/supermarket-group.entity';

@Injectable()
export class SupermarketsService {
  constructor(
    @InjectRepository(Supermarket)
    private supermarketsRepository: Repository<Supermarket>,
    @InjectRepository(SupermarketGroup) // Add this if not already injected
    private groupsRepository: Repository<SupermarketGroup>, // Note: I need to check if SupermarketGroupsModule exports this or if I need to inject it
  ) {}

  async create(createSupermarketDto: CreateSupermarketDto) {
    try {
      const { clientIds, groupId, ...supermarketData } = createSupermarketDto;
      const supermarket = this.supermarketsRepository.create({
        ...supermarketData,
        group: groupId ? { id: groupId } : null,
        clients: clientIds ? clientIds.map(id => ({ id })) : []
      });
      return await this.supermarketsRepository.save(supermarket);
    } catch (error) {
      console.error('Error creating supermarket:', error);
      if (error.code === '23503') {
        throw new BadRequestException('Grupo ou Clientes inválidos ou não encontrados.');
      }
      if (error.code === '23502') {
        throw new BadRequestException('Campo obrigatório ausente: ' + (error.column || 'desconhecido'));
      }
      if (error.code === '22P02') {
        throw new BadRequestException('Formato de dados inválido (ex: número ou UUID malformado).');
      }
      if (error.code === '22001') {
        throw new BadRequestException('Texto muito longo para um dos campos.');
      }
      throw new InternalServerErrorException('Erro ao criar supermercado: ' + error.message);
    }
  }

  findAll() {
    return this.supermarketsRepository.find({
      relations: ['group', 'clients', 'products']
    });
  }

  findOne(id: string) {
    return this.supermarketsRepository.findOne({ 
      where: { id },
      relations: ['group', 'clients', 'products']
    });
  }

  async update(id: string, updateSupermarketDto: UpdateSupermarketDto) {
    try {
      // First check if supermarket exists
      const existingSupermarket = await this.supermarketsRepository.findOne({ where: { id } });
      if (!existingSupermarket) {
        throw new NotFoundException(`Supermercado com ID ${id} não encontrado.`);
      }

      const { clientIds, productIds, groupId, ...rest } = updateSupermarketDto;
      
      // Update basic fields and group
      const updateData: any = { ...rest };
      
      if (groupId !== undefined) {
          if (groupId) {
             const groupExists = await this.groupsRepository.findOne({ where: { id: groupId } });
             if (!groupExists) {
                 throw new BadRequestException('Grupo de supermercado não encontrado.');
             }
             updateData.group = { id: groupId };
          } else {
             updateData.group = null;
          }
      }
      
      // Merge updates into existing entity to ensure full object for save
      const updatedSupermarket = this.supermarketsRepository.merge(existingSupermarket, updateData);
      
      await this.supermarketsRepository.save(updatedSupermarket);
      
      // If clientIds provided, we need to update the relationship
      if (clientIds) {
        // Reload with clients relation to ensure clean update
        const supermarketWithClients = await this.supermarketsRepository.findOne({ 
          where: { id },
          relations: ['clients'] 
        });
        
        if (supermarketWithClients) {
          supermarketWithClients.clients = clientIds.map(cid => ({ id: cid } as any));
          await this.supermarketsRepository.save(supermarketWithClients);
        }
      }

      // If productIds provided, we need to update the relationship
      if (productIds) {
        // Reload with products relation to ensure clean update
        const supermarketWithProducts = await this.supermarketsRepository.findOne({ 
          where: { id },
          relations: ['products'] 
        });
        
        if (supermarketWithProducts) {
          supermarketWithProducts.products = productIds.map(pid => ({ id: pid } as any));
          await this.supermarketsRepository.save(supermarketWithProducts);
        }
      }
      
      return this.findOne(id);
    } catch (error) {
      console.error('Error updating supermarket:', error);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      if (error.code === '23503') {
        throw new BadRequestException('Grupo ou Clientes inválidos ou não encontrados.');
      }
      if (error.code === '23502') {
        throw new BadRequestException('Campo obrigatório ausente: ' + (error.column || 'desconhecido'));
      }
      if (error.code === '22P02') {
        throw new BadRequestException('Formato de dados inválido (ex: número ou UUID malformado).');
      }
      if (error.code === '22001') {
        throw new BadRequestException('Texto muito longo para um dos campos.');
      }
      if (error.code === '22003') {
        throw new BadRequestException('Valor numérico fora do alcance permitido (ex: latitude/longitude).');
      }
      
      throw new InternalServerErrorException('Erro ao atualizar supermercado: ' + (error.message || 'Erro desconhecido'));
    }
  }

  remove(id: string) {
    return this.supermarketsRepository.delete(id);
  }
}
