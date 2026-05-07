import {
  Controller, Get, Post, Delete,
  Param, ParseIntPipe, UseGuards, Req,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiTags, ApiOperation, ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { ModulesRegistryService } from './modules-registry.service';

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

  /**
   * Мои модули — модули текущего тенанта (читаем tenant_id из JWT).
   * Используется для:
   *   1. Страницы «Мои модули»
   *   2. Sidebar — фильтрация пунктов меню по активным модулям
   */
  @Get('my-modules')
  @ApiOperation({ summary: 'Активные модули текущего тенанта' })
  async getMyModules(@Req() req: any) {
    // tenant_id приходит из JWT (устанавливается при login через tenant lookup)
    const tenantId: number = req.user.tenant_id;
    if (!tenantId) return [];
    return this.modulesService.getTenantModules(tenantId);
  }
}

