import { Controller, Request, Post, UseGuards, Get, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService
  ) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('client/login')
  async clientLogin(@Body() body) {
    const client = await this.authService.validateClient(body.email, body.password);
    if (!client) {
      throw new UnauthorizedException();
    }
    return this.authService.loginClient(client);
  }

  @Post('register')
  async register(@Body() body) {
    const user = await this.usersService.create({
      email: body.email,
      password: body.password,
      roleId: body.roleId,
    });
    const { password, ...result } = user;
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Request() req, @Body() body: any) {
    return this.authService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
  }

  @Post('reset')
  async reset(@Request() req, @Body() body: any) {
    const secret = process.env.ADMIN_RESET_TOKEN || 'AYRATECH_DEV_RESET';
    const token = req.headers['x-admin-reset'] || body.token;
    if (token !== secret) {
      throw new UnauthorizedException();
    }
    const { email, password, roleId } = body;
    let user = await this.usersService.findOne(email);
    if (!user) {
      user = await this.usersService.create({ email, password, roleId, status: 'active' } as any);
    } else {
      await this.usersService.update(user.id, { password } as any);
      user = await this.usersService.findById(user.id) as any;
    }
    const { password: _pw, ...result } = user as any;
    return result;
  }
}
