import {
  Controller, Post, Body, Req, HttpCode, HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBadRequestResponse,
  ApiUnauthorizedResponse, ApiForbiddenResponse, ApiConflictResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, ActivationDto, RefreshDto, LogoutDto } from './dto/auth.dto';
import { AuthTokenResponse, MessageResponse } from './dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Login ──────────────────────────────────────────────────────────────────
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 attempts per minute
  @ApiOperation({ summary: 'Вход в систему', description: 'Возвращает пару JWT-токенов и данные пользователя' })
  @ApiResponse({ status: 200, type: AuthTokenResponse })
  @ApiUnauthorizedResponse({ description: 'Неверный логин или пароль' })
  async login(@Body() dto: LoginDto, @Req() req: any): Promise<AuthTokenResponse> {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? '';
    const ua = req.headers['user-agent'] ?? '';
    return this.authService.login(dto.login, dto.password, ip, ua);
  }

  // ─── Register ────────────────────────────────────────────────────────────────
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } }) // 5 registrations per hour
  @ApiOperation({ summary: 'Регистрация (только BOX/OPENSOURCE режим)', description: 'В CLOUD-режиме заблокировано. Провизионирование через /cloud-admin/tenants.' })
  @ApiResponse({ status: 201, type: MessageResponse })
  @ApiConflictResponse({ description: 'Пользователь с таким логином уже существует' })
  @ApiForbiddenResponse({ description: 'Регистрация отключена (CLOUD mode)' })
  async register(@Body() dto: RegisterDto): Promise<MessageResponse> {
    return this.authService.register(dto.login, dto.password, dto.name, dto.email);
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
  async refresh(@Body() dto: RefreshDto, @Req() req: any): Promise<AuthTokenResponse> {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? '';
    const ua = req.headers['user-agent'] ?? '';
    return this.authService.refresh(dto.refreshToken, ip, ua);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Выход — инвалидация сессии' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async logout(@Body() dto: LogoutDto): Promise<{ success: boolean }> {
    return this.authService.logout(dto.refreshToken);
  }
}
