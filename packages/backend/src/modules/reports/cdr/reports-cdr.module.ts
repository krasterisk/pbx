import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Cdr } from './cdr.model';
import { CdrService } from './cdr.service';
import { CdrController } from './cdr.controller';
import { CdrPublicController } from './cdr-public.controller';
import { SystemSettingsModule } from '../../system-settings/system-settings.module';
import { CloudAdminModule } from '../../cloud-admin/cloud-admin.module';
import { PsEndpoint } from '../../endpoints/ps-endpoint.model';
import { User } from '../../users/user.model';
import { NumberList } from '../../numbers/number-list.model';

@Module({
  imports: [
    SequelizeModule.forFeature([Cdr, PsEndpoint, User, NumberList]),
    SystemSettingsModule,
    CloudAdminModule,
  ],
  controllers: [CdrController, CdrPublicController],
  providers: [CdrService],
  exports: [CdrService],
})
export class ReportsCdrModule {}
