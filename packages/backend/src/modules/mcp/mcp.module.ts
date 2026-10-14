import { AiConnectivityModule } from '../ai-connectivity/ai-connectivity.module';
import { VoiceRobotsModule } from '../voice-robots/voice-robots.module';
import { SupportAiAdapter } from '../support/support-ai.adapter';
import { VoiceRobot } from '../voice-robots/voice-robot.model';
import { VoiceRobotLog } from '../voice-robots/voice-robot-log.model';
import { IntegrationCredentialsModule } from '../integration-credentials/integration-credentials.module';
import { IntegrationPrincipal, IntegrationGrant } from '../integration-credentials/integration-credential.models';
import { User } from '../users/user.model';
import { SupportPlan } from '../support/support-plan.model';
import { SupportService } from '../support/support.service';
import { SupportController } from '../support/support.controller';
import { SupportRuntimeVerifier } from '../support/support-runtime-verifier';
import { TimeGroupsModule } from '../time-groups/time-groups.module';
import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { McpController } from './mcp.controller';
import { McpSessionService } from './mcp-session.service';
import { McpToolsService } from './mcp-tools.service';
import { JwtOrServiceTokenGuard } from '../auth/jwt-or-service-token.guard';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { TrunksModule } from '../trunks/trunks.module';
import { IvrsModule } from '../ivrs/ivrs.module';
import { QueuesModule } from '../queues/queues.module';
import { ContextsModule } from '../contexts/contexts.module';
import { RoutesModule } from '../routes/routes.module';
import { AmiModule } from '../ami/ami.module';
import { AiChatModule } from '../ai-chat/ai-chat.module';
import { AgentProposalsModule } from '../ai-chat/agent-proposals.module';
import { ReportsCdrModule } from '../reports/cdr/reports-cdr.module';
import { Context } from '../contexts/context.model';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { LoggerModule } from '../logger/logger.module';

/**
 * McpModule — MCP Server для KrAsterisk.
 *
 * Endpoints:
 *   GET  /api/mcp/sse          — открыть SSE-поток (initializtion)
 *   POST /api/mcp/message      — JSON-RPC messages
 *   GET  /api/mcp/sessions     — debug: активные сессии
 *
 * Аутентификация: JWT ИЛИ service token (Bearer <KRASTERISK_SERVICE_TOKEN>
 * + X-Vpbx-User-Uid: <tenantId>)
 *
 * ПРАВИЛО АРХИТЕКТУРЫ: При добавлении новой сущности АТС —
 * добавить инструмент в McpToolsService.registerAll()
 */
@Module({
    imports: [
        ConfigModule,
        IntegrationCredentialsModule,
        TimeGroupsModule,
        AiConnectivityModule,
        VoiceRobotsModule,
        SequelizeModule.forFeature([Context, User, IntegrationPrincipal, IntegrationGrant, SupportPlan, VoiceRobot, VoiceRobotLog]),
        EndpointsModule,
        TrunksModule,
        IvrsModule,
        QueuesModule,
        ContextsModule,
        RoutesModule,
        AmiModule,
        forwardRef(() => AiChatModule),
        AgentProposalsModule,
        ReportsCdrModule,
        AiPlatformModule,
        LoggerModule,
    ],
    controllers: [McpController, SupportController],
    providers: [
        McpSessionService,
        SupportService,
        SupportAiAdapter,
        SupportRuntimeVerifier,
        McpToolsService,
        JwtOrServiceTokenGuard,
        ServiceTokenGuard,
    ],
    exports: [McpToolsService],
})
export class McpModule {}
