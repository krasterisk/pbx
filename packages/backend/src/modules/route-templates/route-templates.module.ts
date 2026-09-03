import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RouteTemplate } from './route-template.model';
import { RouteTemplatesController } from './route-templates.controller';
import { RouteTemplatesService } from './route-templates.service';
import { RouteTemplatesAiAdapter } from './route-templates-ai.adapter';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { Queue } from '../queues/queue.model';
import { CallGroup } from '../call-groups/call-group.model';
import { Ivr } from '../ivrs/ivr.model';
import { PsEndpoint } from '../endpoints/ps-endpoint.model';
import { Prompt } from '../prompts/prompt.model';
import { Directory } from '../directories/directory.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      RouteTemplate,
      Queue,
      CallGroup,
      Ivr,
      PsEndpoint,
      Prompt,
      Directory,
    ]),
    AiPlatformModule,
  ],
  controllers: [RouteTemplatesController],
  providers: [RouteTemplatesService, RouteTemplatesAiAdapter],
  exports: [RouteTemplatesService],
})
export class RouteTemplatesModule {}
