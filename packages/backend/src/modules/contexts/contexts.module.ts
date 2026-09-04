import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Context } from './context.model';
import { ContextsService } from './contexts.service';
import { ContextsController } from './contexts.controller';
import { ContextsAiAdapter } from './contexts-ai.adapter';
import { AmiModule } from '../ami/ami.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';

@Module({
  imports: [SequelizeModule.forFeature([Context]), forwardRef(() => AmiModule), AiPlatformModule],
  providers: [ContextsService, ContextsAiAdapter],
  controllers: [ContextsController],
  exports: [ContextsService],
})
export class ContextsModule {}
