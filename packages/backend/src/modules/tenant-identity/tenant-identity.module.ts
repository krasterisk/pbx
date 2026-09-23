import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Tenant } from '../cloud-admin/tenant.model';
import { User } from '../users/user.model';
import { BillingSeller } from '../cloud-admin/billing-seller.model';
import { TenantIdentityService } from './tenant-identity.service';

@Module({
  imports: [SequelizeModule.forFeature([User, Tenant, BillingSeller])],
  providers: [TenantIdentityService],
  exports: [TenantIdentityService],
})
export class TenantIdentityModule {}
