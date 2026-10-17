import {
  Controller, Get, Post, Body, Req, HttpCode, HttpStatus,
  UseGuards, Res,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBadRequestResponse,
  ApiUnauthorizedResponse, ApiForbiddenResponse, ApiConflictResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, ActivationDto, RefreshDto, LogoutDto } from './dto/auth.dto';
import { AuthTokenResponse, MessageResponse } from './dto/auth-response.dto';
import type { Response } from 'express';
import { InteractiveSessionService } from './interactive-session.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly interactive: InteractiveSessionService) {}

  // ─── Login ──────────────────────────────────────────────────────────────────
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 attempts per minute
  @ApiOperation({ summary: 'Вход в систему', description: 'Возвращает пару JWT-токенов и данные пользователя' })
  @ApiResponse({ status: 200, type: AuthTokenResponse })
  @ApiUnauthorizedResponse({ description: 'Неверный логин или пароль' })
  async login(@Body() dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response): Promise<AuthTokenResponse> {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? '';
    const ua = req.headers['user-agent'] ?? '';
    const result = await this.authService.login(dto.login, dto.password, ip, ua);
    this.interactive.issue(res, result, req);
    return result;
  }

  // ─── Public auth policy ──────────────────────────────────────────────────────
  @Get('config')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Публичные параметры входа', description: 'Сообщает, открыта ли самостоятельная регистрация организации.' })
  async publicConfig(): Promise<{ deploymentMode: 'box' | 'cloud' | 'opensource'; registrationEnabled: boolean }> {
    return {
      deploymentMode: this.authService.getDeploymentMode(),
      registrationEnabled: await this.authService.isRegistrationEnabled(),
    };
  }

  // ─── Register ────────────────────────────────────────────────────────────────
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } }) // 5 registrations per hour
  @ApiOperation({ summary: 'Регистрация организации', description: 'Доступна, когда в глобальных настройках платформы включена возможность регистрации. Иначе только вход.' })
  @ApiResponse({ status: 201, type: MessageResponse })
  @ApiConflictResponse({ description: 'Пользователь с таким логином уже существует' })
  @ApiForbiddenResponse({ description: 'Регистрация отключена в глобальных настройках' })
  async register(@Body() dto: RegisterDto): Promise<MessageResponse> {
    return this.authService.register(dto.login, dto.password, dto.name, dto.email, dto.companyName);
  }

  // ─── Activation ──────────────────────────────────────────────────────────────
  @Post('activation')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Активация аккаунта по коду из email' })
  @ApiResponse({ status: 200, type: MessageResponse })
  @ApiBadRequestResponse({ description: 'Неверный или истёкший код' })
  async activate(@Body() dto: ActivationDto): Promise<MessageResponse> {
    return this.authService.activate(dto.login, dto.code);
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновление access-токена через refresh-токен' })
  @ApiResponse({ status: 200, type: AuthTokenResponse })
  @ApiUnauthorizedResponse({ description: 'Refresh token недействителен или истёк' })
  async refresh(@Body() dto: RefreshDto, @Req() req: any, @Res({ passthrough: true }) res: Response): Promise<AuthTokenResponse> {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? '';
    const ua = req.headers['user-agent'] ?? '';
    const result = await this.authService.refresh(dto.refreshToken, ip, ua);
    this.interactive.rotate(req, res, dto.refreshToken, result);
    return result;
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Выход — инвалидация сессии' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async logout(@Body() dto: LogoutDto, @Res({ passthrough: true }) res: Response): Promise<{ success: boolean }> {
    const result = await this.authService.logout(dto.refreshToken);
    this.interactive.clear(res);
    return result;
  }
}
