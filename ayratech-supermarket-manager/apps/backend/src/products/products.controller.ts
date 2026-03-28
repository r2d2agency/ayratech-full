import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFiles, HttpException, HttpStatus } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { UploadService } from '../upload/upload.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly uploadService: UploadService
  ) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'referenceImage', maxCount: 1 },
  ]))
  async create(
    @Body() createProductDto: CreateProductDto, 
    @UploadedFiles() files: { image?: Express.Multer.File[], referenceImage?: Express.Multer.File[] }
  ) {
    try {
      this.parseMultipartFields(createProductDto);

      if (files?.image?.[0]) {
        const result = await this.uploadService.uploadFile(files.image[0], {
          subDir: 'products',
          width: 800,
          quality: 80,
          prefix: 'product'
        });
        createProductDto.image = result.path; // Or result.url if needed
      }

      if (files?.referenceImage?.[0]) {
        const result = await this.uploadService.uploadFile(files.referenceImage[0], {
          subDir: 'products/references',
          width: 1280,
          quality: 85,
          prefix: 'ref'
        });
        createProductDto.referenceImageUrl = result.path;
      }

      return await this.productsService.create(createProductDto);
    } catch (error) {
      console.error('Error in ProductsController.create:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message || 'Internal server error during creation', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'referenceImage', maxCount: 1 },
  ]))
  async update(
    @Param('id') id: string, 
    @Body() updateProductDto: UpdateProductDto, 
    @UploadedFiles() files: { image?: Express.Multer.File[], referenceImage?: Express.Multer.File[] }
  ) {
    try {
      this.parseMultipartFields(updateProductDto);

      if (files?.image?.[0]) {
        const result = await this.uploadService.uploadFile(files.image[0], {
          subDir: 'products',
          width: 800,
          quality: 80,
          prefix: 'product'
        });
        updateProductDto.image = result.path;
      }

      if (files?.referenceImage?.[0]) {
        const result = await this.uploadService.uploadFile(files.referenceImage[0], {
          subDir: 'products/references',
          width: 1280,
          quality: 85,
          prefix: 'ref'
        });
        updateProductDto.referenceImageUrl = result.path;
      }

      return await this.productsService.update(id, updateProductDto);
    } catch (error) {
      console.error('Error in ProductsController.update:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message || 'Internal server error during update', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  private parseMultipartFields(dto: any) {
    // Parse supermarketGroupIds if it is a string (multipart/form-data)
    if (typeof dto.supermarketGroupIds === 'string') {
      try {
        dto.supermarketGroupIds = JSON.parse(dto.supermarketGroupIds);
      } catch (e) {
        // ignore error
      }
    }

    // Parse supermarketIds if it is a string (multipart/form-data)
    if (typeof dto.supermarketIds === 'string') {
      try {
        dto.supermarketIds = JSON.parse(dto.supermarketIds);
      } catch (e) {
        // ignore error
      }
    }
  }
}
