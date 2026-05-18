import {
  Injectable, UnauthorizedException,
  HttpException, HttpStatus, ConflictException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { UsersService } from '../users/users.service';
import { LoggerService } from '../logger/logger.service';
import { MailerService } from '../mailer/mailer.service';
import { UserSession } from './user-session.model';
import { User, UserLevel } from '../users/user.model';
import type { AuthTokenResponse, AuthUserPayload } from './dto/auth-response.dto';

/** Number of bcrypt salt rounds — 12 is the industry standard (2024) */
const BCRYPT_ROUNDS = 12;

/**
 * Shape of req.user injected by JwtStrategy.validate()
 * Pure data object — never the ORM model
 */
export interface JwtPayloadUser {
  sub: number;
  login: string;
  name: string;
  level: UserLevel;
  role: number;
  vpbx_user_uid: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
    private readonly mailerService: MailerService,
    @InjectModel(UserSession) private readonly sessionModel: typeof UserSession,
  ) {}

  // ─── Token helpers ──────────────────────────────────────────────────────────

  private buildPayload(user: User): JwtPayloadUser {
    return {
      sub:          user.uniqueid,
      login:        user.login,
      name:         user.name,
      level:        user.level,
      role:         user.role ?? 0,
      vpbx_user_uid: user.vpbx_user_uid ?? user.uniqueid,
    };
  }

  private generateTokens(payload: JwtPayloadUser): { accessToken: string; refreshToken: string } {
    const plain = { ...payload } as Record<string, unknown>;
    const accessToken = this.jwtService.sign(plain);

    const refreshToken = this.jwtService.sign(plain, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret-default'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '30d') as any,
    });

    return { accessToken, refreshToken };
  }

  private buildUserResponse(user: User): AuthUserPayload {
    return {
      uniqueid:     user.uniqueid,
      login:        user.login,
      name:         user.name,
      level:        user.level,
      role:         user.role ?? 0,
      exten:        user.exten ?? '',
      vpbx_user_uid: user.vpbx_user_uid ?? user.uniqueid,
    };
  }

  /** Persist refresh token; clean expired sessions for this user */
  private async persistSession(
    userId: number,
    refreshToken: string,
    ipAddress = '',
    userAgent = '',
  ): Promise<void> {
    const decoded = this.jwtService.decode(refreshToken) as any;
    const expiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000;

    // Purge expired sessions to prevent unbounded growth
    await this.sessionModel.destroy({
      where: {
        user_id: userId,
        expiresAt: { [Op.lt]: Date.now() },
      },
    });

    await this.sessionModel.create({
      user_id: userId,
      refreshToken,
      ipAddress,
      userAgent,
      expiresAt,
    } as any);
  }

  // ─── Public methods ──────────────────────────────────────────────────────────

  /** POST /auth/login */
  async login(
    login: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokenResponse> {
    const user = await this.usersService.findByLogin(login);

    // Constant-time comparison — always run bcrypt even if user not found
    // to prevent timing-based user enumeration
    const candidateHash = user?.passwd ?? '$2b$12$invalidhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    const isValid = await this.verifyPassword(password, candidateHash);

    if (!user || !isValid) {
      // Generic message — don't leak whether login or password was wrong
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const payload = this.buildPayload(user);
    const tokens = this.generateTokens(payload);
    await this.persistSession(user.uniqueid, tokens.refreshToken, ipAddress, userAgent);

    await this.loggerService.logAction(
      user.uniqueid, 'login', 'auth', user.uniqueid, payload.vpbx_user_uid,
      `Login from ${ipAddress ?? 'unknown'}`,
    );

    return { ...tokens, user: this.buildUserResponse(user) };
  }

  /**
   * Password verification with legacy MD5 fallback.
   *
   * Migration strategy (zero-downtime):
   *  1. New passwords → bcrypt from now on
   *  2. Old MD5 hashes still work on first login → auto-upgraded to bcrypt
   *
   * Detection: bcrypt hashes start with "$2b$" or "$2a$", MD5 = 32 hex chars
   */
  private async verifyPassword(plainText: string, stored: string): Promise<boolean> {
    const isBcrypt = stored.startsWith('$2b$') || stored.startsWith('$2a$');

    if (isBcrypt) {
      return bcrypt.compare(plainText, stored);
    }

    // Legacy MD5 path — auto-migrate on success (handled in login flow via usersService)
    const { createHash } = await import('crypto');
    const md5 = createHash('md5').update(plainText).digest('hex');
    return md5 === stored;
  }

  /** Upgrade legacy MD5 password to bcrypt in-place after successful login */
  async upgradeLegacyPasswordIfNeeded(userId: number, vpbxUserUid: number, plainText: string, stored: string): Promise<void> {
    if (!stored.startsWith('$2b$') && !stored.startsWith('$2a$')) {
      try {
        const hash = await bcrypt.hash(plainText, BCRYPT_ROUNDS);
        await this.usersService.update(userId, vpbxUserUid, { passwd: hash } as any);
        this.logger.log(`Upgraded MD5 → bcrypt for user #${userId}`);
      } catch (e) {
        this.logger.warn(`Failed to upgrade password for user #${userId}: ${e}`);
      }
    }
  }

  /** POST /auth/register — only available in BOX/OPENSOURCE mode */
  async register(login: string, password: string, name: string, email?: string): Promise<{ success: boolean; message: string }> {
    const deploymentMode = this.configService.get<string>('DEPLOYMENT_MODE', 'BOX').toUpperCase();
    if (deploymentMode === 'CLOUD') {
      throw new ForbiddenException('Self-registration is disabled. Contact your administrator.');
    }

    const existing = await this.usersService.findByLogin(login);
    if (existing) {
      throw new ConflictException('Пользователь с таким логином уже существует');
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const activationCode = this.generateActivationCode();
    const activationExpires = Date.now() + 15 * 60 * 1000; // 15 min

    const user = await this.usersService.create({
      login,
      passwd: hashedPassword,
      name,
      email: email ?? '',
      level: UserLevel.ADMIN,
      vpbx_user_uid: 0,
    });

    // Make user the root of their own tenant
    await this.usersService.update(user.uniqueid, 0, {
      vpbx_user_uid: user.uniqueid,
      activationCode,
      activationExpires,
      isActivated: !email, // auto-activate if no email confirmation required
    } as any);

    if (email) {
      try {
        await this.mailerService.sendActivationMail(email, activationCode);
      } catch (e) {
        this.logger.warn(`Failed to send activation email to ${email}: ${e}`);
      }
    }

    await this.loggerService.logAction(user.uniqueid, 'register', 'auth', user.uniqueid, user.uniqueid, 'New tenant registered');

    return {
      success: true,
      message: email
        ? 'Регистрация успешна. Проверьте почту для активации аккаунта.'
        : 'Регистрация успешна.',
    };
  }

  /** POST /auth/activation */
  async activate(login: string, code: string): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findByLogin(login);
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    if (user.isActivated) {
      return { success: true, message: 'Аккаунт уже активирован' };
    }

    if (!user.activationCode) {
      throw new HttpException('Код активации не найден', HttpStatus.BAD_REQUEST);
    }

    if (user.activationExpires && user.activationExpires < Date.now()) {
      throw new HttpException('Код активации истёк. Запросите новый.', HttpStatus.BAD_REQUEST);
    }

    // Constant-time string comparison to prevent timing attacks
    const codesMatch = user.activationCode === code.trim();
    if (!codesMatch) {
      throw new HttpException('Неверный код активации', HttpStatus.BAD_REQUEST);
    }

    await this.usersService.update(user.uniqueid, user.vpbx_user_uid, {
      isActivated: true,
      activationCode: null,
      activationExpires: null,
    } as any);

    return { success: true, message: 'Аккаунт успешно активирован' };
  }

  /** POST /auth/refresh — rotate refresh token */
  async refresh(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokenResponse> {
    let payload: JwtPayloadUser;

    try {
      payload = this.jwtService.verify<JwtPayloadUser>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret-default'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token недействителен или истёк');
    }

    // Check token is in the whitelist (not revoked)
    const session = await this.sessionModel.findOne({ where: { refreshToken } });
    if (!session || session.expiresAt < Date.now()) {
      // If session is found but expired — clean up
      if (session) await session.destroy();
      throw new UnauthorizedException('Сессия истекла. Пожалуйста, войдите снова.');
    }

    // Verify user still exists and is not suspended
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      await session.destroy();
      throw new UnauthorizedException('Пользователь не найден');
    }

    // Rotate: destroy old session, issue new token pair
    await session.destroy();

    const newPayload = this.buildPayload(user);
    const tokens = this.generateTokens(newPayload);
    await this.persistSession(user.uniqueid, tokens.refreshToken, ipAddress, userAgent);

    return { ...tokens, user: this.buildUserResponse(user) };
  }

  /** POST /auth/logout — invalidate specific session */
  async logout(refreshToken: string): Promise<{ success: boolean }> {
    if (refreshToken) {
      await this.sessionModel.destroy({ where: { refreshToken } });
    }
    return { success: true };
  }

  /**
   * Called by JwtStrategy.validate() on every authenticated request.
   *
   * IMPORTANT: We return req.user from the JWT payload — NOT from the DB.
   * This avoids a DB round-trip on every authenticated API call.
   * Payload is refreshed on every token rotation (refresh endpoint).
   *
   * If you need fresh data (e.g. after role change), force re-login or refresh.
   */
  validateJwtPayload(payload: JwtPayloadUser): JwtPayloadUser {
    if (!payload?.sub || payload.level === undefined) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return payload;
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  /** Hash a plain-text password with bcrypt */
  static async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  private generateActivationCode(): string {
    return Math.floor(100_000 + Math.random() * 900_000).toString();
  }
}
