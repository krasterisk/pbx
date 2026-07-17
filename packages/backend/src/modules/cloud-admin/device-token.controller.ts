import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  assertValidDeviceToken,
  DeviceTokenService,
} from './device-token.service';

/** POST body for FCM / push device token registration (NAV-12 / D-32). */
export interface RegisterDeviceTokenDto {
  token: string;
  platform?: string;
}

type DeviceTokenUser = {
  sub?: number;
  uniqueid?: number;
  vpbx_user_uid?: number;
  tenant_id?: number;
};

/**
 * Device token registration for Capacitor Push (D-32).
 * JWT-bound upsert — no campaign UX.
 */
@ApiTags('Marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class DeviceTokenController {
  constructor(private readonly deviceTokenService: DeviceTokenService) {}

  @Post('device-token')
  @ApiOperation({ summary: 'Register FCM/device push token for current user' })
  async register(
    @Body() body: RegisterDeviceTokenDto,
    @Req() req: { user?: DeviceTokenUser },
  ): Promise<{ ok: true }> {
    const userUid = req?.user?.sub ?? req?.user?.uniqueid;
    if (!req?.user || userUid == null) {
      throw new UnauthorizedException('Authentication required to register device token');
    }

    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    assertValidDeviceToken(token);

    if (body.platform != null && typeof body.platform !== 'string') {
      throw new BadRequestException('platform must be a string when provided');
    }

    await this.deviceTokenService.upsertForUser({
      userUid,
      tenantId: req.user.tenant_id,
      vpbxUserUid: req.user.vpbx_user_uid,
      token,
      platform: body.platform,
    });

    return { ok: true };
  }
}
