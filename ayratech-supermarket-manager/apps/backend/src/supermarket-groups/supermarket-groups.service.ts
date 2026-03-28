import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SupermarketGroup } from './entities/supermarket-group.entity';
import { Product } from '../entities/product.entity';
import { CreateSupermarketGroupDto } from './dto/create-supermarket-group.dto';
import { UpdateSupermarketGroupDto } from './dto/update-supermarket-group.dto';

@Injectable()
export class SupermarketGroupsService {
  constructor(
    @InjectRepository(SupermarketGroup)
    private supermarketGroupRepository: Repository<SupermarketGroup>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  create(createSupermarketGroupDto: CreateSupermarketGroupDto) {
    const group = this.supermarketGroupRepository.create(createSupermarketGroupDto);
    return this.supermarketGroupRepository.save(group);
  }

  findAll() {
    return this.supermarketGroupRepository.find({
      relations: ['products'],
    });
  }

  findOne(id: string) {
    return this.supermarketGroupRepository.findOne({
      where: { id },
      relations: ['products', 'products.brand'],
    });
  }

  async update(id: string, updateSupermarketGroupDto: UpdateSupermarketGroupDto) {
    const group = await this.findOne(id);
    if (!group) {
      throw new Error('Group not found');
    }

    const { productIds, ...otherUpdates } = updateSupermarketGroupDto;

    if (productIds !== undefined) {
      if (productIds.length === 0) {
        group.products = [];
      } else {
        const products = await this.productRepository.findBy({ id: In(productIds) });
        group.products = products;
      }
    }

    Object.assign(group, otherUpdates);
    
    return this.supermarketGroupRepository.save(group);
  }

  remove(id: string) {
    return this.supermarketGroupRepository.delete(id);
  }
}
