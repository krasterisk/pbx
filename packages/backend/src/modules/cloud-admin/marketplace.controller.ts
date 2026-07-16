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
   * Fallback: resolve tenants.id via vpbx_user_uid when JWT lacks tenant_id
   * (payload currently carries vpbx_user_uid; billing/modules keys use tenants.id).
   */
  private async requireTenantAdmin(req: any): Promise<number> {
    let tenantId: number | undefined = req.user?.tenant_id;
    if (!tenantId && req.user?.vpbx_user_uid) {
      const tenant = await this.tenantsService.findByVpbxUid(req.user.vpbx_user_uid);
      tenantId = tenant?.id;
    }
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
