import {
  BadRequestException,
  Body,
  Controller,
  NotImplementedException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/** POST body for FCM / push device token registration (NAV-12 / D-32). */
export interface RegisterDeviceTokenDto {
  token: string;
  platform?: string;
}

/**
 * Device token registration skeleton for Capacitor Push (D-32).
 *
 * Wave 0 stub (plan 08-13): JWT + body validation, then NotImplemented.
 * Full register/persist: plan 08-11.
 *
 * Not wired into CloudAdminModule routes beyond this class — 08-11 owns wiring.
 */
@ApiTags('Device tokens')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('device-tokens')
export class DeviceTokenController {
  @Post()
  @ApiOperation({ summary: 'Register FCM/device push token for current user' })
  async register(
    @Body() body: RegisterDeviceTokenDto,
    @Req() req: { user?: { uniqueid?: number; vpbx_user_uid?: number } },
  ): Promise<void> {
    // JWT-bound: reject anonymous register (T-08-19)
    if (!req?.user || req.user.uniqueid == null) {
      throw new UnauthorizedException('Authentication required to register device token');
    }

    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!token) {
      throw new BadRequestException('token is required');
    }

    if (body.platform != null && typeof body.platform !== 'string') {
      throw new BadRequestException('platform must be a string when provided');
    }

    // 08-11: persist token bound to authenticated user/tenant
    throw new NotImplementedException(
      'DeviceTokenController.register — persist in plan 08-11',
    );
  }
}
