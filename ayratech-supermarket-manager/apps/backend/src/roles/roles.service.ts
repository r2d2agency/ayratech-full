import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) {}

  async onModuleInit() {
    const defaultRoles = [
      { name: 'admin', description: 'Administrador do sistema', accessLevel: 'all', permissions: ['all'] },
      { name: 'supervisor', description: 'Supervisor de operações', accessLevel: 'high', permissions: ['view_dashboard', 'manage_routes', 'view_reports'] },
      { name: 'promoter', description: 'Promotor de vendas', accessLevel: 'medium', permissions: ['view_routes', 'submit_checklist'] },
      { name: 'user', description: 'Usuário padrão', accessLevel: 'low', permissions: [] },
    ];

    for (const roleData of defaultRoles) {
      const existing = await this.rolesRepository.findOne({ where: { name: roleData.name } });
      if (!existing) {
        await this.rolesRepository.save(this.rolesRepository.create(roleData));
        console.log(`Role created: ${roleData.name}`);
      } else if (!existing.permissions) {
        // Update permissions if they are missing (for existing roles)
        await this.rolesRepository.update(existing.id, { permissions: roleData.permissions });
        console.log(`Role permissions updated: ${roleData.name}`);
      }
    }
  }

  create(createRoleDto: CreateRoleDto) {
    const role = this.rolesRepository.create(createRoleDto);
    return this.rolesRepository.save(role);
  }

  findAll() {
    return this.rolesRepository.find();
  }

  findOne(id: string) {
    return this.rolesRepository.findOne({ where: { id } });
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    if (Object.keys(updateRoleDto).length > 0) {
      await this.rolesRepository.update(id, updateRoleDto);
    }
    return this.findOne(id);
  }

  remove(id: string) {
    return this.rolesRepository.delete(id);
  }
}
