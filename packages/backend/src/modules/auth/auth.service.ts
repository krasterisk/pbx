import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(login: string, password: string) {
    const user = await this.usersService.findByLogin(login);
    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwd);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const payload = {
      sub: user.uniqueid,
      login: user.login,
      level: user.level,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        uniqueid: user.uniqueid,
        login: user.login,
        name: user.name,
        level: user.level,
        role: user.role,
        exten: user.exten,
      },
    };
  }

  async validateToken(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
