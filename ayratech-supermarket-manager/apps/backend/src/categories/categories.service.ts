import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from '../entities/product.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  create(createCategoryDto: CreateCategoryDto) {
    const { parentId, ...data } = createCategoryDto;
    const category = this.categoriesRepository.create({
      ...data,
      parent: parentId ? { id: parentId } : null,
    });
    return this.categoriesRepository.save(category);
  }

  findAll() {
    return this.categoriesRepository.find({
      relations: ['parent', 'children'],
      order: { name: 'ASC' }
    });
  }

  findOne(id: string) {
    return this.categoriesRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const { parentId, ...data } = updateCategoryDto;
    const updateData: any = { ...data };
    
    if (parentId !== undefined) {
      updateData.parent = parentId ? { id: parentId } : null;
    }

    if (Object.keys(updateData).length > 0) {
      await this.categoriesRepository.update(id, updateData);
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    // Check for subcategories
    const subcategoriesCount = await this.categoriesRepository.count({
      where: { parent: { id } }
    });

    if (subcategoriesCount > 0) {
      throw new BadRequestException('Não é possível excluir esta categoria pois ela possui subcategorias.');
    }

    // Check for products
    const productsCount = await this.productsRepository.count({
      where: { categoryRef: { id } }
    });

    if (productsCount > 0) {
      throw new BadRequestException('Não é possível excluir esta categoria pois existem produtos associados a ela.');
    }

    return this.categoriesRepository.delete(id);
  }
}
