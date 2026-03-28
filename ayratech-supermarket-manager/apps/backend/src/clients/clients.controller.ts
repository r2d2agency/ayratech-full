import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UPLOAD_ROOT } from '../config/upload.config';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('logo', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = join(UPLOAD_ROOT, 'clients');
        // Ensure directory exists - though better to do this at startup
        // but fs.mkdirSync is synchronous.
        const fs = require('fs');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  create(@Body() createClientDto: CreateClientDto, @UploadedFile() file?: Express.Multer.File) {
    if (file) {
      // Store relative path to allow frontend to prepend correct API URL
      createClientDto.logo = `/uploads/clients/${file.filename}`;
    }
    // Parse photoConfig if it is a string (multipart/form-data)
    if (typeof createClientDto.photoConfig === 'string') {
      try {
        createClientDto.photoConfig = JSON.parse(createClientDto.photoConfig);
      } catch (e) {
        // ignore error, leave as is or set to undefined
      }
    }
    return this.clientsService.create(createClientDto);
  }

  @Get()
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('logo', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = join(UPLOAD_ROOT, 'clients');
        const fs = require('fs');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto, @UploadedFile() file?: Express.Multer.File) {
    if (file) {
      updateClientDto.logo = `/uploads/clients/${file.filename}`;
    }
    // Parse photoConfig if it is a string (multipart/form-data)
    if (typeof updateClientDto.photoConfig === 'string') {
      try {
        updateClientDto.photoConfig = JSON.parse(updateClientDto.photoConfig);
      } catch (e) {
        // ignore error
      }
    }
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
