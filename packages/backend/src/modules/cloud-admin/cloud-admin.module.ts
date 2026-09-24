import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { requireJwtSecret } from '../auth/jwt-secret';
import { Tenant } from './tenant.model';
import { BillingSeller } from './billing-seller.model';
import { ModuleRegistry } from './module-registry.model';
import { TenantModule } from './tenant-module.model';
import { HubModule } from './models/hub-module.model';
import { HubModulePage } from './models/hub-module-page.model';
import { RoleStartDefault, TenantRoleStart } from './models/role-start.model';
import { DeviceToken } from './models/device-token.model';
import { User } from '../users/user.model';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import {
  TenantModulesController, MarketplaceController, AiProductCatalogMaintenanceController,
  TenantHubEntitlementsController, AiProductEntitleController,
} from './tenant-modules.controller';
import { MarketplacePurchaseController } from './marketplace.controller';
import { DeviceTokenController } from './device-token.controller';
import { HubModulesController } from './hub-modules.controller';
import {
  PlatformRoleStartController,
  MarketplaceRoleStartController,
} from './role-start.controller';
import { ModulesRegistryService } from './modules-registry.service';
import { PurchaseModuleService } from './purchase-module.service';
import { RoleStartService } from './role-start.service';
import { DeviceTokenService } from './device-token.service';
import { ModuleAccessGuard } from './module-access.guard';
import { UsersModule } from '../users/users.module';
import { LoggerModule } from '../logger/logger.module';
import { MailerModule } from '../mailer/mailer.module';
import { BillingModule } from './billing/billing.module';
import { CloudSetting } from './cloud-setting.model';
import { CloudSettingsService } from './cloud-settings.service';
import { BillingSellersService } from './billing-sellers.service';
import { BillingSellersController } from './billing-sellers.controller';
import { PlatformPricesService } from './platform-prices.service';
import { PlatformPricesController } from './platform-prices.controller';
import { ProductAccessModule } from '../product-access/product-access.module';
import { TenantIdentityModule } from '../tenant-identity/tenant-identity.module';
import { AiConnectivityModule } from '../ai-connectivity/ai-connectivity.module';
import { GlobalProvidersController } from './global-providers.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Tenant, BillingSeller, ModuleRegistry, TenantModule, User, CloudSetting,
      HubModule, HubModulePage,
      RoleStartDefault, TenantRoleStart,
      DeviceToken,
    ]),
    UsersModule,
    LoggerModule,
    MailerModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: requireJwtSecret(config),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '2h') as any,
          issuer: 'krasterisk-v4',
          audience: 'krasterisk-v4-client',
        },
      }),
      inject: [ConfigService],
    }),
    BillingModule,
    ProductAccessModule,
    TenantIdentityModule,
    AiConnectivityModule,
  ],
  providers: [
    TenantsService,
    ModulesRegistryService,
    PurchaseModuleService,
    RoleStartService,
    DeviceTokenService,
    ModuleAccessGuard,
    CloudSettingsService,
    BillingSellersService,
    PlatformPricesService,
  ],
  controllers: [
    TenantsController,
    TenantModulesController,
    TenantHubEntitlementsController,
    AiProductEntitleController,
    AiProductCatalogMaintenanceController,
    MarketplaceController,
    MarketplacePurchaseController,
    DeviceTokenController,
    HubModulesController,
    PlatformRoleStartController,
    MarketplaceRoleStartController,
    BillingSellersController,
    PlatformPricesController,
    GlobalProvidersController,
  ],
  exports: [
    TenantsService,
    ModulesRegistryService,
    PurchaseModuleService,
    RoleStartService,
    DeviceTokenService,
    ModuleAccessGuard,
    BillingModule,
    CloudSettingsService,
    BillingSellersService,
    PlatformPricesService,
  ],
})
export class CloudAdminModule {}
