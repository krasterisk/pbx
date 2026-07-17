/**
 * Call Center settings REST API.
 *
 * RBAC:
 * - Operator (own): GET/PUT /operator — id from req.user.sub (IDOR mitigation T-07-05-01)
 * - Supervisor: GET/PUT /operator/:operatorId — own tenant only (T-07-05-03)
 * - Tenant singleton: GET open to tenant auth; PUT requires assertSupervisor (T-07-05-02)
 */
import {
  Controller, Get, Put, Body, Param, Req, UseGuards, ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserLevel } from '../users/user.model';
import { CallCenterSettingsService } from './callcenter-settings.service';
import {
  UpdateOperatorSettingsDto,
  UpdateCcSettingsDto,
} from './dto/callcenter-settings.dto';

/**
 * Supervisor/admin gate. UserLevel is inverted privilege (ADMIN=1, SUPERVISOR=3),
 * so numeric `level >= 3` would block ADMIN and allow READONLY — use set membership.
 */
function assertSupervisor(user: any): void {
  const allowed = new Set([
    UserLevel.SUPERADMIN,
    UserLevel.ADMIN,
    UserLevel.SUPERVISOR,
  ]);
  if (!allowed.has(user.level)) {
    throw new ForbiddenException('Supervisor access required (level >= 3)');
  }
}

@UseGuards(JwtAuthGuard)
@Controller('callcenter/settings')
export class CallCenterSettingsController {
  constructor(private readonly settingsService: CallCenterSettingsService) {}

  @Get('operator')
  getMyOperatorSettings(@Req() req: Request & { user: any }) {
    return this.settingsService.getOperatorSettings(
      req.user.vpbx_user_uid,
      req.user.sub,
    );
  }

  @Put('operator')
  updateMyOperatorSettings(
    @Body() dto: UpdateOperatorSettingsDto,
    @Req() req: Request & { user: any },
  ) {
    return this.settingsService.updateOperatorSettings(
      req.user.vpbx_user_uid,
      req.user.sub,
      dto,
    );
  }

  @Get('operator/:operatorId')
  getOperatorSettingsBySupervisor(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.getOperatorSettings(
      req.user.vpbx_user_uid,
      operatorId,
    );
  }

  @Put('operator/:operatorId')
  updateOperatorSettingsBySupervisor(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Body() dto: UpdateOperatorSettingsDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.updateOperatorSettings(
      req.user.vpbx_user_uid,
      operatorId,
      dto,
    );
  }

  @Get('tenant')
  getTenantSettings(@Req() req: Request & { user: any }) {
    return this.settingsService.getTenantSettings(req.user.vpbx_user_uid);
  }

  @Put('tenant')
  updateTenantSettings(
    @Body() dto: UpdateCcSettingsDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.updateTenantSettings(
      req.user.vpbx_user_uid,
      dto,
    );
  }
}
