import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { EmployeesService } from '../employees/employees.service';
import { ClientsService } from '../clients/clients.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private employeesService: EmployeesService,
    private clientsService: ClientsService,
    private jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, pass: string): Promise<any> {
    console.log(`Validating user: ${identifier}`);
    try {
      let user;
      
      // Check if identifier is CPF (simple check: 11 digits numbers only)
      // If the input has formatting like 111.222.333-44, we clean it.
      // If it's an email, cleaning might remove chars but length check should distinguish.
      const cleanIdentifier = identifier.replace(/\D/g, '');
      
      // Basic heuristic: if it looks like a CPF (11 digits) and wasn't an email structure
      const isEmail = identifier.includes('@');
      
      if (!isEmail && cleanIdentifier.length === 11) {
          const employees = await this.employeesService.findByCpf(cleanIdentifier);
          
          for (const employee of employees) {
              const candidateUser = await this.usersService.findByEmployeeId(employee.id);
              
              if (candidateUser) {
                  // Check password for EVERY candidate, if Active
                  if (candidateUser.status === 'active') {
                      const isMatch = await bcrypt.compare(pass, candidateUser.password);
                      if (isMatch) {
                          console.log(`User validated successfully: ${candidateUser.email}`);
                          const { password, ...result } = candidateUser;
                          return result;
                      }
                  }
              }
          }
          // If we are here, no active user with correct password was found via CPF.
          // Fall through to email check or return null
      }

      // Fallback to email search if not found via CPF
      if (!user) {
          user = await this.usersService.findOne(identifier);
      }

      if (!user) {
          console.warn(`User not found: ${identifier}`);
          return null;
      }
      
      const isPasswordValid = await bcrypt.compare(pass, user.password);
      if (user && isPasswordValid) {
        if (user.status?.toLowerCase() !== 'active') {
             console.warn(`User ${user.email} is not active`);
             return null;
        }
        console.log(`User validated successfully: ${user.email}`);
        const { password, ...result } = user;
        return result;
      }
      console.warn(`Invalid password for user: ${user.email}`);
      return null;
    } catch (err) {
        console.error(`Error validating user ${identifier}:`, err);
        return null;
    }
  }

  async login(user: any) {
    console.log(`Logging in user: ${user.email}`);
    
    const sessionId = randomUUID();
    await this.usersService.updateSession(user.id, sessionId);

    const payload = { 
      username: user.email, 
      email: user.email,
      sub: user.id, 
      sessionId: sessionId,
      role: user.role?.name || 'user',
      employee: user.employee ? {
        id: user.employee.id,
        fullName: user.employee.fullName
      } : null
    };
    const token = this.jwtService.sign(payload);
    console.log(`Generated token for ${user.email}: ${token.substring(0, 20)}...`);
    return {
      access_token: token,
      user: payload,
    };
  }

  async validateClient(email: string, pass: string): Promise<any> {
    console.log(`[AuthService] Validating client login for email: ${email}`);
    const client = await this.clientsService.findByEmail(email);
    
    if (!client) {
      console.warn(`[AuthService] Client not found for email: ${email}`);
      return null;
    }

    if (!client.password) {
      console.warn(`[AuthService] Client has no password set: ${email}`);
      return null;
    }

    const isMatch = await bcrypt.compare(pass, client.password);
    if (isMatch) {
      console.log(`[AuthService] Client password match for: ${email}`);
      const { password, ...result } = client;
      return result;
    }

    console.warn(`[AuthService] Invalid password for client: ${email}`);
    return null;
  }

  async loginClient(client: any) {
    const payload = { 
      username: client.emailPrincipal, 
      email: client.emailPrincipal,
      sub: client.id, 
      role: 'client',
      clientId: client.id,
      razaoSocial: client.razaoSocial,
      logo: client.logo
    };
    const token = this.jwtService.sign(payload);
    return {
      access_token: token,
      user: payload,
    };
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    const isMatch = await bcrypt.compare(currentPass, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    await this.usersService.update(userId, { password: newPass });
    return { message: 'Senha alterada com sucesso.' };
  }
}
