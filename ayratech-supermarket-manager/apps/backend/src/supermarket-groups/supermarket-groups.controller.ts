import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SupermarketGroupsService } from './supermarket-groups.service';
import { CreateSupermarketGroupDto } from './dto/create-supermarket-group.dto';
import { UpdateSupermarketGroupDto } from './dto/update-supermarket-group.dto';

@Controller('supermarket-groups')
export class SupermarketGroupsController {
  constructor(private readonly supermarketGroupsService: SupermarketGroupsService) {}

  @Post()
  create(@Body() createSupermarketGroupDto: CreateSupermarketGroupDto) {
    return this.supermarketGroupsService.create(createSupermarketGroupDto);
  }

  @Get()
  findAll() {
    return this.supermarketGroupsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supermarketGroupsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSupermarketGroupDto: UpdateSupermarketGroupDto) {
    return this.supermarketGroupsService.update(id, updateSupermarketGroupDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.supermarketGroupsService.remove(id);
  }
}
