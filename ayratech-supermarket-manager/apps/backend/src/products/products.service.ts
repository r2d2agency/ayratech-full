import { Injectable, ConflictException, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const { brandId, clientId, categoryId, supermarketGroupIds, supermarketIds, ...productData } = createProductDto;
      
      // Basic validation
      if (!clientId) {
        throw new BadRequestException('Client ID is required');
      }

      const product = this.productsRepository.create({
        ...productData,
        brand: brandId ? { id: brandId } : null,
        client: clientId ? { id: clientId } : null,
        categoryRef: categoryId ? { id: categoryId } : null,
        supermarketGroups: supermarketGroupIds ? supermarketGroupIds.map(id => ({ id })) : [],
        supermarkets: supermarketIds ? supermarketIds.map(id => ({ id })) : []
      });
      return await this.productsRepository.save(product);
    } catch (error) {
      if (error.code === '23505') {
        const detail = error.detail || '';
        if (detail.includes('sku')) {
          throw new ConflictException('Já existe um produto cadastrado com este SKU.');
        } else if (detail.includes('barcode')) {
          throw new ConflictException('Já existe um produto cadastrado com este Código de Barras.');
        } else if (detail.includes('name')) {
          throw new ConflictException('Já existe um produto cadastrado com este Nome.');
        }
        throw new ConflictException('Já existe um produto cadastrado com este SKU, Nome ou Código de Barras.');
      }
      if (error.code === '23503') {
        throw new BadRequestException('Cliente, Marca ou Categoria inválidos ou não encontrados.');
      }
      console.error('Error creating product:', error);
      throw error;
    }
  }

  findAll() {
    return this.productsRepository.find({ relations: ['brand', 'brand.client', 'client', 'categoryRef', 'categoryRef.parent', 'checklistTemplate', 'supermarketGroups', 'supermarkets'] });
  }

  findOne(id: string) {
    return this.productsRepository.findOne({ 
      where: { id },
      relations: ['brand', 'brand.client', 'client', 'categoryRef', 'categoryRef.parent', 'checklistTemplate', 'supermarketGroups', 'supermarkets']
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    try {
      const product = await this.productsRepository.findOne({ where: { id } });
      if (!product) {
        throw new NotFoundException('Produto não encontrado');
      }

      const { brandId, clientId, categoryId, checklistTemplateId, supermarketGroupIds, supermarketIds, ...rest } = updateProductDto;
      
      this.productsRepository.merge(product, rest);
      
      if (brandId !== undefined) {
        product.brand = brandId ? ({ id: brandId } as any) : null;
      }
      
      if (clientId !== undefined) {
        product.client = clientId ? ({ id: clientId } as any) : null;
      }

      if (categoryId !== undefined) {
        product.categoryRef = categoryId ? ({ id: categoryId } as any) : null;
      }

      if (checklistTemplateId !== undefined) {
        product.checklistTemplate = checklistTemplateId ? ({ id: checklistTemplateId } as any) : null;
        product.checklistTemplateId = checklistTemplateId || null;
      }

      if (supermarketGroupIds) {
        product.supermarketGroups = supermarketGroupIds.map(id => ({ id } as any));
      }

      if (supermarketIds) {
        product.supermarkets = supermarketIds.map(id => ({ id } as any));
      }
      
      return await this.productsRepository.save(product);
    } catch (error) {
      if (error.code === '23505') {
        const detail = error.detail || '';
        if (detail.includes('sku')) {
          throw new ConflictException('Já existe um produto cadastrado com este SKU.');
        } else if (detail.includes('barcode')) {
          throw new ConflictException('Já existe um produto cadastrado com este Código de Barras.');
        } else if (detail.includes('name')) {
          throw new ConflictException('Já existe um produto cadastrado com este Nome.');
        }
        throw new ConflictException('Já existe um produto cadastrado com este SKU, Nome ou Código de Barras.');
      }
      if (error.code === '23503') {
        throw new BadRequestException('Cliente, Marca ou Categoria inválidos ou não encontrados.');
      }
      console.error('Error updating product:', error);
      throw new InternalServerErrorException('Erro ao atualizar produto: ' + error.message);
    }
  }

  async remove(id: string) {
    try {
      const result = await this.productsRepository.delete(id);
      if (result.affected === 0) {
        throw new NotFoundException('Produto não encontrado');
      }
      return result;
    } catch (error) {
      if (error.code === '23503') {
        throw new BadRequestException('Este produto não pode ser excluído pois está vinculado a rotas, checklists ou outros registros. Tente inativá-lo.');
      }
      console.error('Error deleting product:', error);
      throw new InternalServerErrorException('Erro ao excluir produto.');
    }
  }
}
