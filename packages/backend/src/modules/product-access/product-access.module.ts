import { Module } from '@nestjs/common';
import { ProductAccessCoreModule } from './product-access-core.module';
import {
  InstallationLicenseController, TenantProductActivationController,
} from './product-access.controller';

@Module({
  imports: [ProductAccessCoreModule],
  controllers: [InstallationLicenseController, TenantProductActivationController],
  exports: [ProductAccessCoreModule],
})
export class ProductAccessModule {}
