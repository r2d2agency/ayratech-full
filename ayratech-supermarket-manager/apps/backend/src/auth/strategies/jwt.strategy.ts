import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private usersService: UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'super-secret-key-123',
    });
  }

  async validate(payload: any) {
    // console.log('JWT Strategy Validate Payload:', payload);
    if (!payload) {
        throw new UnauthorizedException('Token inválido ou expirado');
    }

    // Client Auth Bypass
    if (payload.role === 'client') {
      return {
        userId: payload.sub,
        username: payload.username,
        role: payload.role,
        clientId: payload.clientId,
        razaoSocial: payload.razaoSocial
      };
    }

    // Single Session Check
    if (payload.sub) {
        const user = await this.usersService.findById(payload.sub);
        
        if (!user) {
             throw new UnauthorizedException('Usuário não encontrado.');
        }

        // Check if session matches
        if (user.currentSessionId && payload.sessionId && user.currentSessionId !== payload.sessionId) {
            throw new UnauthorizedException('Sessão expirada. Você logou em outro dispositivo.');
        }
        
        // If token has no sessionId (legacy) but user has a new session, invalidate legacy
        if (!payload.sessionId && user.currentSessionId) {
             throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
        }
    }

    return { 
      userId: payload.sub, 
      username: payload.username, 
      role: payload.role,
      employee: payload.employee 
    };
  }
}
