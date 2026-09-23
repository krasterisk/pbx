import {
  Body, Controller, Post, Req, UseGuards, ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserLevel } from '../users/user.model';
import { PurchaseModuleDto } from './dto/purchase-module.dto';
import { PurchaseModuleService } from './purchase-module.service';
import { TenantsService } from './tenants.service';
import { resolveTenantIdFromJwt } from './tenant-binding';

/**
 * Marketplace purchase — tenant ADMIN JWT only (NAV-07 / D-23).
 * Catalog/my-modules/hub endpoints remain on TenantModulesController.
 */
@ApiTags('Marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplacePurchaseController {
  constructor(
    private readonly purchaseService: PurchaseModuleService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Post('purchase')
  @ApiOperation({ summary: 'Purchase module — charge balance then activate' })
  @ApiResponse({ status: 201, description: 'Module purchased and activated' })
  @ApiResponse({ status: 402, description: 'Insufficient balance' })
  async purchase(@Req() req: any, @Body() dto: PurchaseModuleDto) {
    const tenantId = await this.requireTenantAdmin(req);
    const result = await this.purchaseService.purchase(
      tenantId,
      dto.moduleCode,
      req.user.sub,
    );
    return { success: true, ...result };
  }

  /**
   * Tenant id from JWT only — never from body.
   * ADMIN may omit tenant_id; tenants.id is resolved via vpbx_user_uid.
   * SUPERADMIN is not a cabinet: entitlements use /cloud-admin/tenants/:id.
   */
  private async requireTenantAdmin(req: any): Promise<number> {
    if (req.user?.level !== UserLevel.ADMIN) {
      throw new ForbiddenException('Tenant binding required');
    }
    const tenantId = await resolveTenantIdFromJwt(
      req.user,
      (uid) => this.tenantsService.findByVpbxUid(uid),
    );
    if (tenantId == null) {
      throw new ForbiddenException('Tenant binding required');
    }
    return tenantId;
  }
}
