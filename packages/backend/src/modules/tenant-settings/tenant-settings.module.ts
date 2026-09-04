import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LoggerModule } from '../logger/logger.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { TenantSetting } from './tenant-setting.model';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsService } from './tenant-settings.service';
import { TenantSettingsAiAdapter } from './tenant-settings-ai.adapter';

@Module({
  imports: [SequelizeModule.forFeature([TenantSetting]), LoggerModule, AiPlatformModule],
  controllers: [TenantSettingsController],
  providers: [TenantSettingsService, TenantSettingsAiAdapter],
  exports: [TenantSettingsService],
})
export class TenantSettingsModule {}
