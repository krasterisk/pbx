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
import { TimeGroupsModule } from '../time-groups/time-groups.module';
import { Context } from '../contexts/context.model';
import { RouteDirectoryBinding } from '../directories/route-directory-binding.model';
import { Directory } from '../directories/directory.model';
import { DirectoryField } from '../directories/directory-field.model';

// RouteDirectoryBinding/Directory/DirectoryField are registered here so
// RoutesService/RouteApplyService can @InjectModel them without importing
// DirectoriesModule (avoids a module cycle).
@Module({
  imports: [
    SequelizeModule.forFeature([Route, ContextInclude, WebhookFailure, Context, RouteDirectoryBinding, Directory, DirectoryField]),
    AmiModule,
    TimeGroupsModule,
  ],
  controllers: [RoutesController, ContextIncludesController, DialplanWebhooksController],
  providers: [
    RoutesService,
    ContextIncludesService,
    RouteApplyService,
    DialplanWebhooksService,
    // String alias for AmiService ModuleRef.get('DialplanWebhooksService')
    {
      provide: 'DialplanWebhooksService',
      useExisting: DialplanWebhooksService,
    },
    WebhookQueueService,
  ],
  exports: [RoutesService, ContextIncludesService, RouteApplyService, DialplanWebhooksService, WebhookQueueService],
})
export class RoutesModule {}
