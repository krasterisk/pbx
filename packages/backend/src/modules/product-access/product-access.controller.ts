import {
  BadRequestException, Body, Controller, ForbiddenException, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { UserLevel } from '../users/user.model';
import { isAiProductCode } from '../cloud-admin/product-access-policy';
import { ProductAccessService } from './product-access.service';

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
  constructor(private readonly products: ProductAccessService) {}

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
