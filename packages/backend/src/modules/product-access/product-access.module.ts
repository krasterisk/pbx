import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ProductAccessCoreModule } from './product-access-core.module';
import {
  InstallationLicenseController, PlatformSkuCatalogController, TenantProductActivationController,
} from './product-access.controller';
import { SkuCatalogService } from './sku-catalog.service';
import { BillingModule } from '../cloud-admin/billing/billing.module';
import { Tenant } from '../cloud-admin/tenant.model';
import { TenantModule } from '../cloud-admin/tenant-module.model';
import {
  AiPriceRevision, AiQuotaCounter, AiSkuEntitlement, AiSkuOffer, AiSkuRevision,
  AiTrialPolicySnapshot,
} from '../ai-usage/usage.models';

@Module({
  imports: [
    ProductAccessCoreModule,
    BillingModule,
    SequelizeModule.forFeature([
      Tenant, TenantModule, AiTrialPolicySnapshot, AiSkuRevision, AiSkuOffer,
      AiSkuEntitlement, AiQuotaCounter, AiPriceRevision,
    ]),
  ],
  providers: [SkuCatalogService],
  controllers: [
    InstallationLicenseController, TenantProductActivationController, PlatformSkuCatalogController,
  ],
  exports: [ProductAccessCoreModule, SkuCatalogService],
})
export class ProductAccessModule {}
