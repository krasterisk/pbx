import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LoggerModule } from '../logger/logger.module';
import { TenantSetting } from './tenant-setting.model';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsService } from './tenant-settings.service';

@Module({
  imports: [SequelizeModule.forFeature([TenantSetting]), LoggerModule],
  controllers: [TenantSettingsController],
  providers: [TenantSettingsService],
  exports: [TenantSettingsService],
})
export class TenantSettingsModule {}
