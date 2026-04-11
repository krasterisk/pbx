import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { LoggerService } from '../logger/logger.service';
import { MailerService } from '../mailer/mailer.service';
import { InjectModel } from '@nestjs/sequelize';
import { UserSession } from './user-session.model';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly loggerService: LoggerService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    @InjectModel(UserSession) private readonly userSessionModel: typeof UserSession,
  ) {}

  private generateTokens(payload: any) {
    const accessToken = this.jwtService.sign(payload);
    
    // Create refresh token with a different secret and expiration
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET', 'refresh-secret-default'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return { accessToken, refreshToken };
  }

  private async saveToken(userId: number, refreshToken: string, ip: string = '', userAgent: string = '') {
    // Determine expiration from token simply by decoding it
    const decoded = this.jwtService.decode(refreshToken) as any;
    const expiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
    
    return this.userSessionModel.create({
      user_id: userId,
      refreshToken,
      ipAddress: ip,
      userAgent,
      expiresAt,
    } as any);
  }

  async login(login: string, password: string) {
    const user = await this.usersService.findByLogin(login);
    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const hashedInput = crypto.createHash('md5').update(password).digest('hex');
    const isPasswordValid = hashedInput === user.passwd;
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const payload = {
      sub: user.uniqueid,
      login: user.login,
      level: user.level,
      role: user.role,
      vpbx_user_uid: user.vpbx_user_uid || user.uniqueid,
    };

    await this.loggerService.logAction(user.uniqueid, 'login', 'auth', user.uniqueid, payload.vpbx_user_uid, 'User logged in successfully');

    const tokens = this.generateTokens(payload);
    await this.saveToken(user.uniqueid, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        uniqueid: user.uniqueid,
        login: user.login,
        name: user.name,
        level: user.level,
        role: user.role,
        exten: user.exten,
        vpbx_user_uid: payload.vpbx_user_uid,
      },
    };
  }

  async register(login: string, password: string, name: string, email?: string) {
    const existing = await this.usersService.findByLogin(login);
    if (existing) {
      throw new HttpException('User already exists', HttpStatus.BAD_REQUEST);
    }

    const activationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const activationExpires = Date.now() + 10 * 60 * 1000;

    // Pass vpbx_user_uid: 0 initially, we will update it immediately after creation to match its own uniqueid
    const user = await this.usersService.create({
      login,
      password,
      name,
      email: email || '',
      level: 1, // UserLevel.ADMIN
      vpbx_user_uid: 0, 
    });

    // Update to make it a tenant root and add activation code
    await this.usersService.update(user.uniqueid, 0, { 
      vpbx_user_uid: user.uniqueid,
      activationCode,
      activationExpires,
      isActivated: false,
    } as any);

    if (email) {
      await this.mailerService.sendActivationMail(email, activationCode);
    }

    await this.loggerService.logAction(user.uniqueid, 'register', 'auth', user.uniqueid, user.uniqueid, 'User registered new tenant');

    return { success: true, message: 'Registration successful. If email was provided, check it for activation code.' };
  }

  async activate(email: string, code: string) {
    // We would need a findByEmail in usersService, or we just search via findAll/filter for simplicity or add findByEmail.
    // Let's assume usersService has findByEmail. For now, since findByLogin uses `login`, and users usually login with `login` or `email`,
    // wait, aiPBX login was email based. Krasterisk login is `login` string based.
    // Let's just activate by login instead of email.
    
    const user = await this.usersService.findByLogin(email); // Assume login is passed instead of email, or user provides login
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    if (!user.activationCode) throw new HttpException('Already activated', HttpStatus.BAD_REQUEST);
    if (user.activationExpires && user.activationExpires < Date.now()) throw new HttpException('Code expired', HttpStatus.BAD_REQUEST);
    if (user.activationCode !== code.trim()) throw new HttpException('Invalid code', HttpStatus.BAD_REQUEST);

    await this.usersService.update(user.uniqueid, user.vpbx_user_uid, {
       isActivated: true,
       activationCode: null,
       activationExpires: null,
    } as any);

    return { success: true, message: 'Account successfully activated' };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    try {
      // 1. Verify token signature and expiration
      const userData = this.jwtService.verify(refreshToken, {
         secret: this.configService.get('JWT_REFRESH_SECRET', 'refresh-secret-default')
      });
      
      // 2. Verify token is explicitly present in database (i.e. not revoked)
      const tokenFromDb = await this.userSessionModel.findOne({ where: { refreshToken } });
      if (!tokenFromDb) {
        throw new UnauthorizedException('Refresh token is invalid or revoked');
      }

      // 3. Find user
      const user = await this.usersService.findById(userData.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // 4. Generate new tokens and rotate
      const payload = {
        sub: user.uniqueid,
        login: user.login,
        level: user.level,
        role: user.role,
        vpbx_user_uid: user.vpbx_user_uid || user.uniqueid,
      };

      const tokens = this.generateTokens(payload);
      
      // Rotate: delete old token, save new token
      await tokenFromDb.destroy();
      await this.saveToken(user.uniqueid, tokens.refreshToken);

      return {
        ...tokens,
        user: {
          uniqueid: user.uniqueid,
          login: user.login,
          name: user.name,
          level: user.level,
          role: user.role,
          exten: user.exten,
          vpbx_user_uid: payload.vpbx_user_uid,
        },
      };

    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    if (refreshToken) {
      await this.userSessionModel.destroy({ where: { refreshToken } });
    }
    return { success: true };
  }

  async validateToken(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}

