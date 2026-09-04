import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Prompt } from './prompt.model';
import { PromptsService } from './prompts.service';
import { PromptsController } from './prompts.controller';
import { AmiModule } from '../ami/ami.module';
import { IvrsModule } from '../ivrs/ivrs.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { PromptsAiAdapter } from './prompts-ai.adapter';

@Module({
  imports: [
    SequelizeModule.forFeature([Prompt]),
    AmiModule,
    IvrsModule,
    SystemSettingsModule,
    AiPlatformModule,
  ],
  controllers: [PromptsController],
  providers: [PromptsService, PromptsAiAdapter],
  exports: [PromptsService],
})
export class PromptsModule {}
