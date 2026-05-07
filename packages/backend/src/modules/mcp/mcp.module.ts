import { Module } from '@nestjs/common';
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
import { Context } from '../contexts/context.model';

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
        SequelizeModule.forFeature([Context]),
        EndpointsModule,
        TrunksModule,
        IvrsModule,
        QueuesModule,
        ContextsModule,
        RoutesModule,
        AmiModule,
        AiChatModule,
    ],
    controllers: [McpController],
    providers: [
        McpSessionService,
        McpToolsService,
        JwtOrServiceTokenGuard,
        ServiceTokenGuard,
    ],
    exports: [McpToolsService],
})
export class McpModule {}
