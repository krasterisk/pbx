import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiChatController } from './ai-chat.controller';
import { PbxContextBuilderService } from './pbx-context-builder.service';
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
import { AiAgentsModule } from '../ai-agents/ai-agents.module';
import { PbxAgentLlmClient } from './pbx-agent-llm.client';
import { PbxStateAiAdapter } from './pbx-state-ai.adapter';
import { PbxAgentLoopService } from './pbx-agent-loop.service';
import { McpModule } from '../mcp/mcp.module';

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
        AiAgentsModule,
        forwardRef(() => McpModule),
    ],
    controllers: [AiChatController],
    providers: [
        PbxAgentLoopService,
        PbxContextBuilderService,
        AiChatSettingsService,
        PbxAgentThreadService,
        PbxAgentLlmClient,
        PbxStateAiAdapter,
        JwtOrServiceTokenGuard,
        ServiceTokenGuard,
    ],
    exports: [PbxContextBuilderService, AiChatSettingsService, PbxAgentThreadService, PbxAgentLlmClient, PbxAgentLoopService],
})
export class AiChatModule {}

