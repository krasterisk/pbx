import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { PbxContextBuilderService } from './pbx-context-builder.service';
import { AiWebhookController } from './ai-webhook.controller';
import { JwtOrServiceTokenGuard } from '../auth/jwt-or-service-token.guard';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { TrunksModule } from '../trunks/trunks.module';
import { IvrsModule } from '../ivrs/ivrs.module';
import { QueuesModule } from '../queues/queues.module';
import { ContextsModule } from '../contexts/contexts.module';
import { RoutesModule } from '../routes/routes.module';
import { AmiModule } from '../ami/ami.module';
import { Context } from '../contexts/context.model';
import { LoggerModule } from '../logger/logger.module';

@Module({
    imports: [
        ConfigModule,
        HttpModule.register({ timeout: 60_000 }),
        SequelizeModule.forFeature([Context]),
        EndpointsModule,
        TrunksModule,
        IvrsModule,
        QueuesModule,
        ContextsModule,
        RoutesModule,
        AmiModule,
        LoggerModule,
    ],
    controllers: [AiChatController, AiWebhookController],
    providers: [
        AiChatService,
        PbxContextBuilderService,
        JwtOrServiceTokenGuard,
        ServiceTokenGuard,
    ],
    exports: [PbxContextBuilderService],
})
export class AiChatModule {}

