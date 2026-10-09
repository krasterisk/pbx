import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Context } from './context.model';
import { ContextsService } from './contexts.service';
import { ContextsController } from './contexts.controller';
import { ContextsAiAdapter } from './contexts-ai.adapter';
import { AmiModule } from '../ami/ami.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { ContextInclude } from '../routes/context-include.model';
import { ContextIncludesService } from '../routes/context-includes.service';

@Module({
  imports: [SequelizeModule.forFeature([Context, ContextInclude]), forwardRef(() => AmiModule), AiPlatformModule, TenantSettingsModule],
  providers: [ContextsService, ContextsAiAdapter, ContextIncludesService],
  controllers: [ContextsController],
  exports: [ContextsService, ContextIncludesService],
})
export class ContextsModule {}
