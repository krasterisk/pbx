import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Queue } from './queue.model';
import { QueueMember } from './queue-member.model';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { QueuesAiAdapter } from './queues-ai.adapter';
import { AmiModule } from '../ami/ami.module';
import { RouteReferencesModule } from '../route-references/route-references.module';
import { ContextsModule } from '../contexts/contexts.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Queue, QueueMember]),
    AmiModule,
    RouteReferencesModule,
    ContextsModule,
    EndpointsModule,
    AiPlatformModule,
  ],
  providers: [QueuesService, QueuesAiAdapter],
  controllers: [QueuesController],
  exports: [QueuesService],
})
export class QueuesModule {}
