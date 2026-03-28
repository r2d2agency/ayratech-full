import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) {}

  async onModuleInit() {
    const count = await this.usersRepository.count();
    if (count === 0) {
      const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@ayratech.app.br';
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const existing = await this.usersRepository.findOne({ where: { email: defaultEmail } });
      
      if (!existing) {
        // Ensure admin role exists
        let adminRole = await this.rolesRepository.findOne({ where: { name: 'admin' } });
        if (!adminRole) {
            // Should have been created by RolesService, but just in case
            adminRole = await this.rolesRepository.save(
                this.rolesRepository.create({ name: 'admin', description: 'Admin', accessLevel: 'all' })
            );
        }

        await this.create({ 
            email: defaultEmail, 
            password: defaultPassword, 
            roleId: adminRole.id, // Use actual UUID
            status: 'active' 
        });
        console.log('Default admin user created.');
      }
    }
  }

  async findOne(email: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ 
      where: { email },
      relations: ['role', 'employee', 'clients']
    });
  }

  async findByEmployeeId(employeeId: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ 
      where: { employeeId },
      relations: ['role', 'employee', 'clients'],
      order: { status: 'ASC', updatedAt: 'DESC' } // Prefer active users, then most recently updated
    });
  }

  async updateSession(userId: string, sessionId: string): Promise<void> {
    await this.usersRepository.update(userId, { 
      currentSessionId: sessionId,
      lastLoginAt: new Date()
    });
  }

  async findById(id: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ 
      where: { id },
      relations: ['role', 'employee', 'clients']
    });
  }

  async findAll(): Promise<User[]> {
    try {
      return await this.usersRepository.find({ relations: ['role', 'employee', 'clients'] });
    } catch (err) {
      console.error('Error in findAll users:', err);
      // Return empty array instead of throwing 500 to allow UI to render
      return [];
    }
  }

  async findAdminsAndHR(): Promise<User[]> {
    // Find all users with admin or rh roles
    // We need to use QueryBuilder or simple find if relations work
    const users = await this.usersRepository.find({
      relations: ['role']
    });
    return users.filter(u => ['admin', 'rh', 'manager', 'administrador do sistema', 'supervisor de operações'].includes(u.role?.name?.toLowerCase()));
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Safety check for repository injection
    if (!this.rolesRepository) {
        console.error('RolesRepository not injected');
        throw new BadRequestException('Erro interno: Repositório de cargos não disponível.');
    }

    // Validate roleId if present
    if (createUserDto.roleId !== undefined && createUserDto.roleId !== null) {
       const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
       
       if (!createUserDto.roleId || !uuidRegex.test(createUserDto.roleId)) {
          delete createUserDto.roleId;
       } else {
          try {
              const roleExists = await this.rolesRepository.findOne({ where: { id: createUserDto.roleId } });
              if (!roleExists) {
                 throw new BadRequestException('Cargo selecionado não existe.');
              }
          } catch (e) {
              console.error('Error checking role existence:', e);
              // If check fails (e.g. DB error), assume invalid or let save handle it, but better to fail safe
              throw new BadRequestException('Erro ao validar cargo.');
          }
       }
    } else {
       delete createUserDto.roleId;
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createUserDto.password || '123456', salt);
    
    const { roleId, employeeId, clientIds, ...userData } = createUserDto;
    
    const newUser = this.usersRepository.create({
      ...userData,
      password: hashedPassword,
      role: roleId ? { id: roleId } : null,
      employee: employeeId ? { id: employeeId } : null,
      clients: clientIds ? clientIds.map(cid => ({ id: cid } as any)) : [],
    });
    
    try {
      return await this.usersRepository.save(newUser);
    } catch (err: any) {
      console.error('Erro ao criar usuário:', err);
      if (err?.code === '23505') {
        throw new BadRequestException('Email já cadastrado');
      }
      // Handle FK violations
      if (err?.code === '23503') {
         throw new BadRequestException('Erro de relacionamento (Cargo ou Funcionário inválido).');
      }
      throw new BadRequestException('Erro ao criar usuário. Verifique os dados.');
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<any> {
    if (updateUserDto.roleId !== undefined) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (!updateUserDto.roleId || !uuidRegex.test(updateUserDto.roleId)) {
        // If invalid/empty, remove role association (set to null if your DB logic allows, or just ignore invalid value)
        // Here we assume empty string means "remove role" or "no role"
        if (updateUserDto.roleId === '' || updateUserDto.roleId === null) {
            updateUserDto.roleId = null; // Explicitly set to null to remove role
        } else {
            // If it's some garbage string that is not empty/null, we should probably ignore it or throw error.
            // Let's remove it to be safe, preventing DB error.
            delete updateUserDto.roleId;
        }
      } else {
         // Valid UUID, check existence
         const roleExists = await this.rolesRepository.findOne({ where: { id: updateUserDto.roleId } });
         if (!roleExists) {
           throw new BadRequestException(`Cargo inválido ou não encontrado.`);
         }
      }
    }
    
    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt();
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, salt);
    }
    
    try {
      const user = await this.usersRepository.findOne({ where: { id } });
      if (!user) {
          throw new BadRequestException('Usuário não encontrado.');
      }

      const { roleId, employeeId, clientIds, ...userData } = updateUserDto;
      
      // Merge basic fields
      Object.assign(user, userData);
      
      // Handle relations by setting FK columns and relations explicitly
      if (roleId !== undefined) {
        const newRoleId = (roleId && roleId !== '') ? roleId : null;
        user.roleId = newRoleId;
        user.role = newRoleId ? { id: newRoleId } as any : null;
      }
      
      if (employeeId !== undefined) {
        const newEmployeeId = (employeeId && employeeId !== '') ? employeeId : null;
        user.employeeId = newEmployeeId;
        user.employee = newEmployeeId ? { id: newEmployeeId } as any : null;
      }

      if (clientIds !== undefined) {
          user.clients = clientIds.map(cid => ({ id: cid } as any));
      }

      await this.usersRepository.save(user);

      return this.usersRepository.findOne({ where: { id }, relations: ['role', 'employee', 'clients'] });
    } catch (err: any) {
      console.error('Erro ao atualizar usuário:', err);
      if (err?.code === '23505') {
        if (err.detail && err.detail.includes('email')) {
          throw new BadRequestException('Email já cadastrado');
        }
        throw new BadRequestException('Dados já cadastrados no sistema (email ou vínculo duplicado).');
      }
      // Handle FK violations
      if (err?.code === '23503') {
         throw new BadRequestException('Erro de relacionamento (Cargo ou Funcionário inválido).');
      }
      
      throw new BadRequestException(`Erro ao atualizar usuário: ${err.message || 'Verifique os dados'}`);
    }
  }

  async remove(id: string): Promise<any> {
    return this.usersRepository.delete(id);
  }
}
