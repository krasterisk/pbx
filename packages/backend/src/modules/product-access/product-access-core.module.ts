import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { Tenant } from '../cloud-admin/tenant.model';
import { TenantModule } from '../cloud-admin/tenant-module.model';
import { ActionLog } from '../logger/action-log.model';
import { ProductActivation } from './product-activation.model';
import { LocalLicenseDocument } from './local-license-document.model';
import { LocalLicenseBinding } from './local-license-binding.model';
import { ProductAccessService } from './product-access.service';

/** Policy repository without management HTTP controllers or cloud-admin tasks. */
@Module({
  imports: [ConfigModule, SequelizeModule.forFeature([
    Tenant, TenantModule, ActionLog,
    ProductActivation, LocalLicenseDocument, LocalLicenseBinding,
  ])],
  providers: [ProductAccessService],
  exports: [ProductAccessService],
})
export class ProductAccessCoreModule {}
