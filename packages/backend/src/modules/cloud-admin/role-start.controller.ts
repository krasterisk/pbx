import {
  Body, Controller, Get, Put, Req, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { UserLevel } from '../users/user.model';
import { RoleStartService } from './role-start.service';
import { ModulesRegistryService } from './modules-registry.service';
import { UpsertRoleStartDefaultsDto, UpsertTenantRoleStartDto } from './dto/role-start.dto';

@ApiTags('Cloud Admin — Role Start')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/role-start')
export class PlatformRoleStartController {
  constructor(private readonly roleStartService: RoleStartService) {}

  @Get()
  @ApiOperation({ summary: 'List platform role→start defaults' })
  listDefaults() {
    return this.roleStartService.listDefaults();
  }

  @Put()
  @ApiOperation({ summary: 'Upsert platform role→start defaults (SuperAdmin only)' })
  upsertDefaults(@Body() dto: UpsertRoleStartDefaultsDto) {
    return this.roleStartService.upsertDefaults(dto.rows);
  }
}

@ApiTags('Marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceRoleStartController {
  constructor(
    private readonly roleStartService: RoleStartService,
    private readonly modulesService: ModulesRegistryService,
  ) {}

  /**
   * Resolved start path for current user (tenant override → platform → D-16).
   */
  @Get('role-start')
  @ApiOperation({ summary: 'Resolve role→start path for current user' })
  async getRoleStart(@Req() req: any) {
    const level = req.user?.level as UserLevel | undefined;
    const tenantId: number | undefined = req.user?.tenant_id;
    let callCenterEnabled = true;
    if (tenantId) {
      const catalog = await this.modulesService.getHubCatalogForTenant(tenantId);
      const cc = catalog.find((m) => m.code === 'callcenter');
      callCenterEnabled = !cc || cc.licenseStatus === 'active';
    }
    const path = await this.roleStartService.resolveStart(level, tenantId, { callCenterEnabled });
    return { path, user_level: level, callCenterEnabled };
  }

  @Get('role-start/overrides')
  @ApiOperation({ summary: 'List tenant role→start overrides for current tenant' })
  listOverrides(@Req() req: any) {
    const tenantId = this.requireTenantId(req);
    return this.roleStartService.listTenantOverrides(tenantId);
  }

  @Put('role-start')
  @ApiOperation({ summary: 'Upsert tenant role→start overrides (JWT tenant only)' })
  upsertOverrides(@Req() req: any, @Body() dto: UpsertTenantRoleStartDto) {
    const tenantId = this.requireTenantAdmin(req);
    // Never accept body.tenant_id — bind from JWT only (T-08-04)
    return this.roleStartService.upsertTenantOverrides(tenantId, dto.rows);
  }

  private requireTenantId(req: any): number {
    const tenantId: number | undefined = req.user?.tenant_id;
    if (!tenantId) throw new ForbiddenException('Tenant binding required');
    return tenantId;
  }

  private requireTenantAdmin(req: any): number {
    const tenantId = this.requireTenantId(req);
    const level = req.user?.level;
    if (level !== UserLevel.ADMIN && level !== UserLevel.SUPERADMIN) {
      throw new ForbiddenException('Tenant ADMIN required');
    }
    return tenantId;
  }
}
