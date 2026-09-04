import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { PbxContextBuilderService } from './pbx-context-builder.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { AiWebhookController } from './ai-webhook.controller';
import { AiChatSettings } from './ai-chat-settings.model';
import { AiChatSettingsService } from './ai-chat-settings.service';
import { AgentThread } from './models/agent-thread.model';
import { AgentThreadMessage } from './models/agent-thread-message.model';
import { AgentProposal } from './models/agent-proposal.model';
import { PbxAgentThreadService } from './pbx-agent-thread.service';
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
        SequelizeModule.forFeature([Context, AiChatSettings, AgentThread, AgentThreadMessage, AgentProposal]),
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
        KnowledgeBaseService,
        AiChatSettingsService,
        PbxAgentThreadService,
        JwtOrServiceTokenGuard,
        ServiceTokenGuard,
    ],
    exports: [PbxContextBuilderService, KnowledgeBaseService, AiChatSettingsService, PbxAgentThreadService],
})
export class AiChatModule {}

