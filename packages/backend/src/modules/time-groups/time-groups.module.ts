import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TimeGroup } from './time-group.model';
import { TimeGroupsController } from './time-groups.controller';
import { TimeGroupsService } from './time-groups.service';
import { TimeGroupsAiAdapter } from './time-groups-ai.adapter';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';

@Module({
  imports: [SequelizeModule.forFeature([TimeGroup]), AiPlatformModule, TenantSettingsModule],
  controllers: [TimeGroupsController],
  providers: [TimeGroupsService, TimeGroupsAiAdapter],
  exports: [TimeGroupsService],
})
export class TimeGroupsModule {}
