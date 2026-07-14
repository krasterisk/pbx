import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Route } from './route.model';
import { ContextInclude } from './context-include.model';
import { WebhookFailure } from './webhook-failure.model';
import { RoutesService } from './routes.service';
import { ContextIncludesService } from './context-includes.service';
import { RouteApplyService } from './route-apply.service';
import { RoutesController } from './routes.controller';
import { ContextIncludesController } from './context-includes.controller';
import { DialplanWebhooksController } from './dialplan-webhooks.controller';
import { DialplanWebhooksService } from './dialplan-webhooks.service';
import { WebhookQueueService } from './webhook-queue.service';
import { AmiModule } from '../ami/ami.module';
import { Context } from '../contexts/context.model';
import { RoutePhonebookBinding } from '../phonebooks/route-phonebook-binding.model';
import { RoutePhonebook } from '../phonebooks/phonebook.model';
import { PhonebookEntry } from '../phonebooks/phonebook-entry.model';

// RoutePhonebookBinding/RoutePhonebook/PhonebookEntry are registered here (in addition to
// PhonebooksModule) so RoutesService/RouteApplyService can @InjectModel them directly —
// without importing PhonebooksModule, which would create a module cycle
// (PhonebooksModule already imports RoutesModule for RouteApplyService).
@Module({
  imports: [
    SequelizeModule.forFeature([Route, ContextInclude, WebhookFailure, Context, RoutePhonebookBinding, RoutePhonebook, PhonebookEntry]),
    AmiModule,
  ],
  controllers: [RoutesController, ContextIncludesController, DialplanWebhooksController],
  providers: [RoutesService, ContextIncludesService, RouteApplyService, DialplanWebhooksService, WebhookQueueService],
  exports: [RoutesService, ContextIncludesService, RouteApplyService, DialplanWebhooksService, WebhookQueueService],
})
export class RoutesModule {}
