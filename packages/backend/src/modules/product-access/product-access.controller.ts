import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { UserLevel } from '../users/user.model';
import { isAiProductCode } from '../cloud-admin/product-access-policy';
import { ProductAccessService } from './product-access.service';
import { SkuCatalogService } from './sku-catalog.service';

@ApiTags('AI Product License')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/ai-products/licenses')
export class InstallationLicenseController {
  constructor(private readonly products: ProductAccessService) {}

  @Post('tenants/:userUid/import')
  importLicense(
    @Param('userUid') userUid: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const target = Number(userUid);
    if (!Number.isSafeInteger(target) || target < 0 || String(target) !== userUid
      || !body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['payload', 'signature', 'replace'].includes(key))
      || (body.replace !== undefined && typeof body.replace !== 'boolean')) {
      throw new BadRequestException({ code: 'license_import_invalid' });
    }
    return this.products.importLicense(target,
      { payload: body.payload, signature: body.signature }, req.user.sub,
      body.replace === true);
  }
}

@ApiTags('AI Product Activation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace/ai-products')
export class TenantProductActivationController {
  constructor(
    private readonly products: ProductAccessService,
    private readonly skus: SkuCatalogService,
  ) {}

  @Get('skus')
  listSkus(@Req() req: any) {
    const uid = req.user?.vpbx_user_uid;
    if (!Number.isSafeInteger(uid) || uid < 0) {
      throw new ForbiddenException({ code: 'tenant_binding_required' });
    }
    return this.skus.listPublished(uid);
  }

  @Post('skus/:code/purchase')
  purchaseSku(@Param('code') code: string, @Req() req: any) {
    const user = req.user;
    if (!user || !Number.isSafeInteger(user.vpbx_user_uid) || user.vpbx_user_uid < 0
      || (user.level !== UserLevel.ADMIN && user.level !== UserLevel.SUPERADMIN)) {
      throw new ForbiddenException({ code: 'tenant_admin_required' });
    }
    return this.skus.purchase(user.vpbx_user_uid, code, user.sub);
  }

  @Put(':code/activation')
  setActivation(@Param('code') code: string, @Body() body: any, @Req() req: any) {
    if (!isAiProductCode(code) || !body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).length !== 1 || typeof body.enabled !== 'boolean') {
      throw new BadRequestException({ code: 'product_activation_invalid' });
    }
    const user = req.user;
    if (!user || !Number.isSafeInteger(user.vpbx_user_uid)
      || user.vpbx_user_uid < 0
      || (user.level !== UserLevel.ADMIN && user.level !== UserLevel.SUPERADMIN)) {
      throw new ForbiddenException({ code: 'tenant_admin_required' });
    }
    return this.products.setActivation(user.vpbx_user_uid, code, body.enabled, user.sub);
  }
}

@ApiTags('AI SKU catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/tenants/:userUid/ai-skus')
export class PlatformSkuCatalogController {
  constructor(private readonly skus: SkuCatalogService) {}

  @Post()
  create(@Param('userUid') userUid: string, @Body() body: any) {
    const owner = Number(userUid);
    if (!Number.isSafeInteger(owner) || owner < 0 || String(owner) !== userUid
      || !body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException({ code: 'sku_invalid' });
    }
    return this.skus.createDraft({
      ownerTenantUid: owner,
      skuCode: body.skuCode,
      product: body.product,
      moneyPolicy: body.moneyPolicy ?? 'shadow',
      priceMonthlyMinor: Number(body.priceMonthlyMinor ?? 0),
      currency: body.currency ?? (body.moneyPolicy === 'local_byok' ? null : 'RUB'),
      trialDays: Number(body.trialDays ?? 0),
      limits: body.limits,
    });
  }

  @Post(':code/publish')
  publish(@Param('userUid') userUid: string, @Param('code') code: string) {
    const owner = Number(userUid);
    if (!Number.isSafeInteger(owner) || owner < 0 || String(owner) !== userUid) {
      throw new BadRequestException({ code: 'sku_invalid' });
    }
    return this.skus.setStatus(owner, code, 'published');
  }

  @Post(':code/revoke')
  revoke(@Param('userUid') userUid: string, @Param('code') code: string) {
    const owner = Number(userUid);
    if (!Number.isSafeInteger(owner) || owner < 0 || String(owner) !== userUid) {
      throw new BadRequestException({ code: 'sku_invalid' });
    }
    return this.skus.setStatus(owner, code, 'revoked');
  }

  @Post(':code/revisions')
  revise(@Param('userUid') userUid: string, @Param('code') code: string, @Body() body: any) {
    const owner = Number(userUid);
    if (!Number.isSafeInteger(owner) || owner < 0 || String(owner) !== userUid) {
      throw new BadRequestException({ code: 'sku_invalid' });
    }
    return this.skus.revise({
      ownerTenantUid: owner, skuCode: code,
      priceMonthlyMinor: Number(body?.priceMonthlyMinor ?? 0),
      currency: body?.currency ?? 'RUB', trialDays: Number(body?.trialDays ?? 0),
      limits: body?.limits,
    });
  }
}
