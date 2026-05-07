import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Tenant } from './tenant.model';
import { ModuleRegistry } from './module-registry.model';
import { TenantModule } from './tenant-module.model';
import { User } from '../users/user.model';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantModulesController, MarketplaceController } from './tenant-modules.controller';
import { ModulesRegistryService } from './modules-registry.service';
import { ModuleAccessGuard } from './module-access.guard';
import { UsersModule } from '../users/users.module';
import { LoggerModule } from '../logger/logger.module';
import { MailerModule } from '../mailer/mailer.module';
import { BillingModule } from './billing/billing.module';
import { CloudSetting } from './cloud-setting.model';
import { CloudSettingsService } from './cloud-settings.service';
import { CloudSettingsController } from './cloud-settings.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([Tenant, ModuleRegistry, TenantModule, User, CloudSetting]),
    UsersModule,
    LoggerModule,
    MailerModule,
    // JwtModule needed for impersonate()
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'krasterisk-v4-secret'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '2h') as any },
      }),
      inject: [ConfigService],
    }),
    BillingModule,
  ],
  providers: [TenantsService, ModulesRegistryService, ModuleAccessGuard, CloudSettingsService],
  controllers: [TenantsController, TenantModulesController, MarketplaceController, CloudSettingsController],
  exports: [TenantsService, ModulesRegistryService, ModuleAccessGuard, BillingModule, CloudSettingsService],
})
export class CloudAdminModule {}
