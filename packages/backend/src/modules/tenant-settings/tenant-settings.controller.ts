import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayloadUser } from '../auth/auth.service';
import { LoggerService } from '../logger/logger.service';
import { TenantSettingsService } from './tenant-settings.service';
import { UpdateTenantSettingsDto } from './dto/tenant-settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('tenant-settings')
export class TenantSettingsController {
  constructor(
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly loggerService: LoggerService,
  ) {}

  @Get()
  getAll(@Req() req: { user: JwtPayloadUser }) {
    return this.tenantSettingsService.getAll(req.user.vpbx_user_uid);
  }

  @Put()
  async setMany(
    @Body() dto: UpdateTenantSettingsDto,
    @Req() req: { user: JwtPayloadUser },
  ) {
    const result = await this.tenantSettingsService.setMany(req.user.vpbx_user_uid, dto.settings);
    await this.loggerService.logAction(
      req.user.sub,
      'update',
      'tenant_settings',
      null,
      req.user.vpbx_user_uid,
      `keys=${Object.keys(dto.settings).join(',')}`,
    );
    return result;
  }
}
