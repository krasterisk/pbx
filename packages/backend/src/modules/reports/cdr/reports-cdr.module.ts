import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Cdr } from './cdr.model';
import { CdrService } from './cdr.service';
import { CdrController } from './cdr.controller';
import { SystemSettingsModule } from '../../system-settings/system-settings.module';
import { CloudAdminModule } from '../../cloud-admin/cloud-admin.module';
import { PsEndpoint } from '../../endpoints/ps-endpoint.model';

@Module({
  imports: [
    SequelizeModule.forFeature([Cdr, PsEndpoint]),
    SystemSettingsModule,
    CloudAdminModule,
  ],
  controllers: [CdrController],
  providers: [CdrService],
  exports: [CdrService],
})
export class ReportsCdrModule {}
