import {
  Controller, Get, Post, Delete, Param, ParseIntPipe, UseGuards, Req, ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiTags, ApiOperation, ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { ModulesRegistryService } from './modules-registry.service';
import { UserLevel } from '../users/user.model';
import { ModuleAccessGuard } from './module-access.guard';
import { RequiresModule } from './requires-module.decorator';

@ApiTags('Cloud Admin — Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/tenants/:tenantId/modules')
export class TenantModulesController {
  constructor(private readonly modulesService: ModulesRegistryService) {}

  @Get()
  @ApiOperation({ summary: 'Список активированных модулей тенанта' })
  findAll(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.modulesService.getTenantModules(tenantId);
  }

  @Post(':moduleCode')
  @ApiOperation({ summary: 'Активировать модуль для тенанта' })
  @ApiResponse({ status: 201, description: 'Модуль активирован' })
  activate(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('moduleCode') moduleCode: string,
  ) {
    return this.modulesService.activateModule(tenantId, moduleCode);
  }

  @Delete(':moduleCode')
  @ApiOperation({ summary: 'Деактивировать модуль (нельзя для core-модулей)' })
  @ApiResponse({ status: 200, description: 'Модуль деактивирован' })
  async deactivate(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('moduleCode') moduleCode: string,
  ) {
    await this.modulesService.deactivateModule(tenantId, moduleCode);
    return { success: true };
  }
}

/** Explicit admin maintenance; never run during normal catalog bootstrap. */
@ApiTags('Cloud Admin — Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/ai-products')
export class AiProductCatalogMaintenanceController {
  constructor(private readonly modulesService: ModulesRegistryService) {}

  @Post('unpublish-unreleased-drafts')
  async unpublishUnreleasedDrafts() {
    return { changed: await this.modulesService.unpublishUnreleasedAiDrafts() };
  }
}

/**
 * Marketplace controller — visible to Tenant Admins
 */
@ApiTags('Marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly modulesService: ModulesRegistryService) {}

  /** Полный каталог модулей (для страницы Marketplace) */
  @Get()
  @ApiOperation({ summary: 'Каталог всех доступных модулей' })
  findAll() {
    return this.modulesService.findAll();
  }

  /** Current server-side projection; grants are visible, but A1 activation is off. */
  @Get('ai-products/status')
  async getAiProductsStatus(@Req() req: any) {
    const uid = req.user?.vpbx_user_uid;
    if (uid === null || uid === undefined) throw new ForbiddenException('Tenant binding required');
    return Promise.all([
      this.modulesService.resolveAiProductAccess(uid, 'ai_voice_robots'),
      this.modulesService.resolveAiProductAccess(uid, 'speech_analytics'),
    ]);
  }

  @Get('ai-products/voice-robots/access')
  @UseGuards(ModuleAccessGuard)
  @RequiresModule('ai_voice_robots')
  checkAiVoiceRobotsAccess() {
    return { allowed: true };
  }

  @Get('ai-products/speech-analytics/access')
  @UseGuards(ModuleAccessGuard)
  @RequiresModule('speech_analytics')
  checkSpeechAnalyticsAccess() {
    return { allowed: true };
  }

  /**
   * Мои модули — модули текущего тенанта (читаем tenant_id из JWT).
   * Используется для:
   *   1. Страницы «Мои модули»
   *   2. Sidebar — фильтрация пунктов меню по активным модулям
   */
  @Get('my-modules')
  @ApiOperation({ summary: 'Активные модули текущего тенанта' })
  async getMyModules(@Req() req: any) {
    const tenantId: number = req.user.tenant_id;
    if (!tenantId) return [];
    return this.modulesService.getTenantModules(tenantId);
  }

  /**
   * Hub catalog with server-computed licenseStatus (D-07 / D-17).
   * Tenant id from JWT only (T-08-04).
   */
  @Get('hub-catalog')
  @ApiOperation({ summary: 'Hub modules with licenseStatus for current tenant' })
  async getHubCatalog(@Req() req: any) {
    const tenantId: number = req.user?.tenant_id ?? 0;
    return this.modulesService.getHubCatalogForTenant(tenantId);
  }

  /**
   * Tenant enable Hub module — JWT tenant_id only; no membership edits (D-22).
   */
  @Post('hub-modules/:code/enable')
  @ApiOperation({ summary: 'Enable Hub module for current tenant' })
  async enableHubModule(@Req() req: any, @Param('code') code: string) {
    const tenantId = this.requireTenantAdmin(req);
    return this.modulesService.setTenantHubModuleStatus(tenantId, code, 'active');
  }

  @Post('hub-modules/:code/disable')
  @ApiOperation({ summary: 'Disable Hub module for current tenant' })
  async disableHubModule(@Req() req: any, @Param('code') code: string) {
    const tenantId = this.requireTenantAdmin(req);
    return this.modulesService.setTenantHubModuleStatus(tenantId, code, 'inactive');
  }

  private requireTenantAdmin(req: any): number {
    const tenantId: number | undefined = req.user?.tenant_id;
    if (!tenantId) {
      throw new ForbiddenException('Tenant binding required');
    }
    const level = req.user?.level;
    if (level !== UserLevel.ADMIN && level !== UserLevel.SUPERADMIN) {
      throw new ForbiddenException('Tenant ADMIN required');
    }
    return tenantId;
  }
}
