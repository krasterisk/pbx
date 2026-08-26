/**
 * Call Center settings REST API.
 *
 * RBAC:
 * - Operator (own): GET/PUT /operator — id from req.user.sub (IDOR mitigation T-07-05-01)
 * - Supervisor: GET/PUT /operator/:operatorId — own tenant only (T-07-05-03)
 * - Tenant singleton: GET open to tenant auth; PUT requires assertSupervisor (T-07-05-02)
 *
 * D-05/D-06/D-38...D-43 (09-13): the same self/:operatorId/tenant split extends to
 * UI customization, granular permissions and the notification matrix — one controller,
 * one IDOR-mitigation pattern (T-09-13-01). Every write derives the operator id from the
 * JWT for self routes; :operatorId/tenant routes are supervisor-gated (T-09-13-02/03).
 *
 * Route ordering note: exact-path self routes (`operator/ui`, `operator/permissions`,
 * `operator/notifications`) MUST be registered before the `operator/:operatorId`
 * wildcard, or Nest/Express would match e.g. `GET operator/ui` against the wildcard
 * (treating "ui" as `operatorId`, then failing `ParseIntPipe`) instead of the intended
 * self route. All self routes are grouped first; the `:operatorId` routes (2-segment
 * wildcard) and the 3-segment `:operatorId/ui|permissions|notifications` routes never
 * collide with each other (different segment counts), so their relative order is safe.
 */
import {
  Controller, Get, Put, Body, Param, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallCenterSettingsService } from './callcenter-settings.service';
import {
  UpdateOperatorSettingsDto,
  UpdateCcSettingsDto,
  UpdateUiCustomizationDto,
  UpdatePermissionsDto,
  UpdateNotificationMatrixDto,
  UpdateRoleDefaultsDto,
} from './dto/callcenter-settings.dto';
import { assertSupervisor } from './callcenter-rbac.util';

@UseGuards(JwtAuthGuard)
@Controller('callcenter/settings')
export class CallCenterSettingsController {
  constructor(private readonly settingsService: CallCenterSettingsService) {}

  // =======================================================================
  // Self (operator, own settings) — id from req.user.sub, never a client param.
  // Exact 2-segment paths; MUST precede the operator/:operatorId wildcard below.
  // =======================================================================

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

  /** D-05/D-06: own tab/panel visibility + softphone placement. */
  @Get('operator/ui')
  getMyUiCustomization(@Req() req: Request & { user: any }) {
    return this.settingsService.getOperatorUiCustomization(
      req.user.vpbx_user_uid,
      req.user.sub,
    );
  }

  @Put('operator/ui')
  updateMyUiCustomization(
    @Body() dto: UpdateUiCustomizationDto,
    @Req() req: Request & { user: any },
  ) {
    return this.settingsService.updateOperatorUiCustomization(
      req.user.vpbx_user_uid,
      req.user.sub,
      dto,
    );
  }

  /** D-38: own effective permission set (role default + own override + locks, merged server-side). */
  @Get('operator/permissions')
  getMyPermissions(@Req() req: Request & { user: any }) {
    return this.settingsService.getOperatorPermissions(
      req.user.vpbx_user_uid,
      req.user.sub,
    );
  }

  @Put('operator/permissions')
  updateMyPermissions(
    @Body() dto: UpdatePermissionsDto,
    @Req() req: Request & { user: any },
  ) {
    return this.settingsService.updateOperatorPermissions(
      req.user.vpbx_user_uid,
      req.user.sub,
      dto,
    );
  }

  /** D-41/D-43: own notification matrix (event × channel). */
  @Get('operator/notifications')
  getMyNotifications(@Req() req: Request & { user: any }) {
    return this.settingsService.getOperatorNotifications(
      req.user.vpbx_user_uid,
      req.user.sub,
    );
  }

  @Put('operator/notifications')
  updateMyNotifications(
    @Body() dto: UpdateNotificationMatrixDto,
    @Req() req: Request & { user: any },
  ) {
    return this.settingsService.updateOperatorNotifications(
      req.user.vpbx_user_uid,
      req.user.sub,
      dto,
    );
  }

  // =======================================================================
  // Supervisor-on-behalf-of (:operatorId is a client param, gated by assertSupervisor)
  // =======================================================================

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

  @Get('operator/:operatorId/ui')
  getUiCustomizationBySupervisor(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.getOperatorUiCustomization(
      req.user.vpbx_user_uid,
      operatorId,
    );
  }

  @Put('operator/:operatorId/ui')
  updateUiCustomizationBySupervisor(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Body() dto: UpdateUiCustomizationDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.updateOperatorUiCustomization(
      req.user.vpbx_user_uid,
      operatorId,
      dto,
    );
  }

  @Get('operator/:operatorId/permissions')
  getPermissionsBySupervisor(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.getOperatorPermissions(
      req.user.vpbx_user_uid,
      operatorId,
    );
  }

  @Put('operator/:operatorId/permissions')
  updatePermissionsBySupervisor(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Body() dto: UpdatePermissionsDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.updateOperatorPermissions(
      req.user.vpbx_user_uid,
      operatorId,
      dto,
    );
  }

  @Get('operator/:operatorId/notifications')
  getNotificationsBySupervisor(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.getOperatorNotifications(
      req.user.vpbx_user_uid,
      operatorId,
    );
  }

  @Put('operator/:operatorId/notifications')
  updateNotificationsBySupervisor(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Body() dto: UpdateNotificationMatrixDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.updateOperatorNotifications(
      req.user.vpbx_user_uid,
      operatorId,
      dto,
    );
  }

  /** D-40: bulk operators × effective rights for the tenant — supervisor-gated. */
  @Get('permissions/matrix')
  getPermissionsMatrix(@Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.settingsService.getPermissionsMatrix(req.user.vpbx_user_uid);
  }

  // =======================================================================
  // Tenant singleton (role-default row)
  // =======================================================================

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

  // D-39/D-43: tenant role defaults + locks — GET and PUT both supervisor-gated
  // (unlike the plain `tenant` singleton above, whose GET is open to any tenant user).

  @Get('tenant/permissions-defaults')
  getTenantPermissionsDefaults(@Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.settingsService.getTenantPermissionsDefaults(req.user.vpbx_user_uid);
  }

  @Put('tenant/permissions-defaults')
  updateTenantPermissionsDefaults(
    @Body() dto: UpdateRoleDefaultsDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.updateTenantPermissionsDefaults(
      req.user.vpbx_user_uid,
      dto,
    );
  }

  @Get('tenant/ui-defaults')
  getTenantUiDefaults(@Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.settingsService.getTenantUiDefaults(req.user.vpbx_user_uid);
  }

  @Put('tenant/ui-defaults')
  updateTenantUiDefaults(
    @Body() dto: UpdateRoleDefaultsDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.updateTenantUiDefaults(
      req.user.vpbx_user_uid,
      dto,
    );
  }

  @Get('tenant/notification-defaults')
  getTenantNotificationDefaults(@Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.settingsService.getTenantNotificationDefaults(req.user.vpbx_user_uid);
  }

  @Put('tenant/notification-defaults')
  updateTenantNotificationDefaults(
    @Body() dto: UpdateRoleDefaultsDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.settingsService.updateTenantNotificationDefaults(
      req.user.vpbx_user_uid,
      dto,
    );
  }
}
