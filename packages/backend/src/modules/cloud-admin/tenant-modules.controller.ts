import {
  Controller, Get, Post, Delete, Param, ParseIntPipe, UseGuards, Req, ForbiddenException,
  BadRequestException, NotFoundException, Body,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiTags, ApiOperation, ApiResponse,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { ModulesRegistryService } from './modules-registry.service';
import { TenantsService } from './tenants.service';
import { UserLevel } from '../users/user.model';
import { ModuleAccessGuard } from './module-access.guard';
import { RequiresModule } from './requires-module.decorator';
import { isAiProductCode } from './product-access-policy';
import { SkuCatalogService } from '../product-access/sku-catalog.service';

export class GrantHubModuleDto {
  @IsIn(['open', 'trial'])
  access!: 'open' | 'trial';

  @ValidateIf((body: GrantHubModuleDto) => body.access === 'trial')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  trialDays?: number;
}

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
    const tenantId = await this.modulesService.resolveTenantIdFromJwt(req.user);
    if (tenantId == null) return [];
    return this.modulesService.getTenantModules(tenantId);
  }

  /**
   * Hub catalog with server-computed licenseStatus (D-07 / D-17).
   * Tenant id from JWT only (T-08-04).
   */
  @Get('hub-catalog')
  @ApiOperation({ summary: 'Hub modules with licenseStatus for current tenant' })
  async getHubCatalog(@Req() req: any) {
    const tenantId = (await this.modulesService.resolveTenantIdFromJwt(req.user)) ?? 0;
    return this.modulesService.getHubCatalogForTenant(tenantId);
  }

  /**
   * Tenant enable/disable. Cabinet comes from the ADMIN JWT, never from a
   * platform SUPERADMIN (they pick a tenant on /cloud-admin/tenants/:id).
   */
  @Post('hub-modules/:code/enable')
  @ApiOperation({ summary: 'Enable Hub module for current tenant' })
  async enableHubModule(@Req() req: any, @Param('code') code: string) {
    const tenantId = await this.requireTenantAdmin(req);
    return this.modulesService.setTenantHubModuleStatus(tenantId, code, 'active', req.user.sub);
  }

  @Post('hub-modules/:code/disable')
  @ApiOperation({ summary: 'Disable Hub module for current tenant' })
  async disableHubModule(@Req() req: any, @Param('code') code: string) {
    const tenantId = await this.requireTenantAdmin(req);
    return this.modulesService.setTenantHubModuleStatus(tenantId, code, 'inactive', req.user.sub);
  }

  private async requireTenantAdmin(req: any): Promise<number> {
    if (req.user?.level !== UserLevel.ADMIN) {
      throw new ForbiddenException('Tenant binding required');
    }
    const tenantId = await this.modulesService.resolveTenantIdFromJwt(req.user);
    if (tenantId == null) {
      throw new ForbiddenException('Tenant binding required');
    }
    return tenantId;
  }
}

/**
 * Platform entitlements for one selected cabinet (D-21).
 * tenantId is the URL, never the SUPERADMIN JWT.
 */
@ApiTags('Cloud Admin — Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/tenants/:tenantId')
export class TenantHubEntitlementsController {
  constructor(
    private readonly modulesService: ModulesRegistryService,
    private readonly tenantsService: TenantsService,
    private readonly skus: SkuCatalogService,
  ) {}

  @Get('hub-catalog')
  @ApiOperation({ summary: 'Hub catalog with licenseStatus for a selected tenant' })
  async hubCatalog(@Param('tenantId', ParseIntPipe) tenantId: number) {
    await this.tenantsService.findOne(tenantId);
    return this.modulesService.getHubCatalogForTenant(tenantId);
  }

  @Post('hub-modules/:code/enable')
  @ApiOperation({ summary: 'Grant or enable a Hub module for a selected tenant' })
  async enable(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('code') code: string,
    @Req() req: any,
  ) {
    await this.tenantsService.findOne(tenantId);
    return this.modulesService.setTenantHubModuleStatus(tenantId, code, 'active', req.user.sub);
  }

  @Post('hub-modules/:code/grant')
  @ApiOperation({ summary: 'Open a hub module or start a trial for a selected tenant' })
  async grant(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('code') code: string,
    @Body() body: GrantHubModuleDto,
    @Req() req: any,
  ) {
    await this.tenantsService.findOne(tenantId);
    if (isAiProductCode(code)) {
      return this.skus.entitleOperator(tenantId, code, req.user.sub, {
        trialDays: body.access === 'trial' ? body.trialDays : 0,
      });
    }
    return this.modulesService.grantHubModule(
      tenantId, code, body.access, body.trialDays, req.user.sub,
    );
  }

  @Post('hub-modules/:code/disable')
  @ApiOperation({ summary: 'Disable a Hub module for a selected tenant' })
  async disable(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('code') code: string,
    @Req() req: any,
  ) {
    await this.tenantsService.findOne(tenantId);
    return this.modulesService.setTenantHubModuleStatus(tenantId, code, 'inactive', req.user.sub);
  }
}

/**
 * SuperAdmin AI entitle: selected cabinet or JWT-bound tenant row.
 */
@ApiTags('Cloud Admin — Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin')
export class AiProductEntitleController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly skus: SkuCatalogService,
  ) {}

  @Post('tenants/:tenantId/ai-products/:code/entitle')
  @ApiOperation({ summary: 'Grant a 0 ₽ shadow SKU and activate the AI product for a cabinet' })
  async entitleTenant(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('code') code: string,
    @Req() req: any,
  ) {
    await this.tenantsService.findOne(tenantId);
    return this.skus.entitleOperator(tenantId, code, req.user.sub);
  }

  @Post('ai-products/:code/entitle-current')
  @ApiOperation({ summary: 'Grant the AI product to the SuperAdmin JWT cabinet, if one exists' })
  async entitleCurrent(@Param('code') code: string, @Req() req: any) {
    if (!isAiProductCode(code)) {
      throw new BadRequestException({ code: 'UNKNOWN_AI_PRODUCT' });
    }
    const uid = req.user?.vpbx_user_uid;
    if (!Number.isSafeInteger(uid) || uid < 0) {
      throw new ForbiddenException({ code: 'tenant_binding_required' });
    }
    const tenant = await this.tenantsService.findByVpbxUid(uid);
    if (!tenant) {
      throw new NotFoundException({ code: 'tenant_not_found' });
    }
    return this.skus.entitleOperator(tenant.id, code, req.user.sub);
  }
}
