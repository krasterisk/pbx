import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';
import { DialplanSubroutinesService } from './dialplan-subroutines.service';
import { SystemSettingsAiAdapter } from './system-settings-ai.adapter';
import { SystemSetting } from './system-setting.model';
import { AmiModule } from '../ami/ami.module';
import { RoutesModule } from '../routes/routes.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';

@Module({
  imports: [
    SequelizeModule.forFeature([SystemSetting]),
    AmiModule,
    RoutesModule,
    AiPlatformModule,
  ],
  providers: [SystemSettingsService, DialplanSubroutinesService, SystemSettingsAiAdapter],
  controllers: [SystemSettingsController],
  exports: [SystemSettingsService, DialplanSubroutinesService],
})
export class SystemSettingsModule {}

