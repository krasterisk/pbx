import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Route } from './route.model';
import { ContextInclude } from './context-include.model';
import { WebhookFailure } from './webhook-failure.model';
import { RoutesService } from './routes.service';
import { ContextIncludesService } from './context-includes.service';
import { RoutesController } from './routes.controller';
import { ContextIncludesController } from './context-includes.controller';
import { DialplanWebhooksController } from './dialplan-webhooks.controller';
import { DialplanWebhooksService } from './dialplan-webhooks.service';
import { WebhookQueueService } from './webhook-queue.service';
import { AmiModule } from '../ami/ami.module';
import { Context } from '../contexts/context.model';

@Module({
  imports: [
    SequelizeModule.forFeature([Route, ContextInclude, WebhookFailure, Context]),
    AmiModule,
  ],
  controllers: [RoutesController, ContextIncludesController, DialplanWebhooksController],
  providers: [RoutesService, ContextIncludesService, DialplanWebhooksService, WebhookQueueService],
  exports: [RoutesService, ContextIncludesService, DialplanWebhooksService, WebhookQueueService],
})
export class RoutesModule {}
