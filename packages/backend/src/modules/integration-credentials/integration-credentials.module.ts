import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from '../users/user.model';
import { Tenant } from '../cloud-admin/tenant.model';
import { ProductAccessCoreModule } from '../product-access/product-access-core.module';
import {
  IntegrationPrincipal, IntegrationCredential, IntegrationGrant,
  IntegrationAudit, IntegrationCommand, IntegrationAuthLimit,
} from './integration-credential.models';
import { TenantContextResolver } from './tenant-context.resolver';
import { TenantContextGuard } from './tenant-context.guard';
import { IntegrationCredentialsService } from './integration-credentials.service';
import { IntegrationKeyRateLimiter } from './integration-key-rate-limiter';
import { IntegrationCredentialsController } from './integration-credentials.controller';
import {
  PRODUCT_RESOURCE_RESOLVERS, ProductResourceAuthorization,
} from './product-resource.authorization';

@Module({
  imports: [ConfigModule, JwtModule.register({}), ProductAccessCoreModule, SequelizeModule.forFeature([
    User, Tenant, IntegrationPrincipal, IntegrationCredential,
    IntegrationGrant, IntegrationAudit, IntegrationCommand, IntegrationAuthLimit,
  ])],
  providers: [
    TenantContextResolver, TenantContextGuard, ProductResourceAuthorization,
    IntegrationCredentialsService,
    IntegrationKeyRateLimiter,
    { provide: PRODUCT_RESOURCE_RESOLVERS, useValue: [] },
  ],
  controllers: [IntegrationCredentialsController],
  exports: [TenantContextResolver, TenantContextGuard,
    ProductResourceAuthorization, IntegrationCredentialsService],
})
export class IntegrationCredentialsModule {}
