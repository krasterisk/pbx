"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const config_1 = require("@nestjs/config");
const mcp_controller_1 = require("./mcp.controller");
const mcp_session_service_1 = require("./mcp-session.service");
const mcp_tools_service_1 = require("./mcp-tools.service");
const jwt_or_service_token_guard_1 = require("../auth/jwt-or-service-token.guard");
const service_token_guard_1 = require("../auth/service-token.guard");
const endpoints_module_1 = require("../endpoints/endpoints.module");
const trunks_module_1 = require("../trunks/trunks.module");
const ivrs_module_1 = require("../ivrs/ivrs.module");
const queues_module_1 = require("../queues/queues.module");
const contexts_module_1 = require("../contexts/contexts.module");
const routes_module_1 = require("../routes/routes.module");
const ami_module_1 = require("../ami/ami.module");
const ai_chat_module_1 = require("../ai-chat/ai-chat.module");
const agent_proposals_module_1 = require("../ai-chat/agent-proposals.module");
const reports_cdr_module_1 = require("../reports/cdr/reports-cdr.module");
const context_model_1 = require("../contexts/context.model");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const logger_module_1 = require("../logger/logger.module");
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
let McpModule = class McpModule {
};
exports.McpModule = McpModule;
exports.McpModule = McpModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            sequelize_1.SequelizeModule.forFeature([context_model_1.Context]),
            endpoints_module_1.EndpointsModule,
            trunks_module_1.TrunksModule,
            ivrs_module_1.IvrsModule,
            queues_module_1.QueuesModule,
            contexts_module_1.ContextsModule,
            routes_module_1.RoutesModule,
            ami_module_1.AmiModule,
            (0, common_1.forwardRef)(() => ai_chat_module_1.AiChatModule),
            agent_proposals_module_1.AgentProposalsModule,
            reports_cdr_module_1.ReportsCdrModule,
            ai_platform_module_1.AiPlatformModule,
            logger_module_1.LoggerModule,
        ],
        controllers: [mcp_controller_1.McpController],
        providers: [
            mcp_session_service_1.McpSessionService,
            mcp_tools_service_1.McpToolsService,
            jwt_or_service_token_guard_1.JwtOrServiceTokenGuard,
            service_token_guard_1.ServiceTokenGuard,
        ],
        exports: [mcp_tools_service_1.McpToolsService],
    })
], McpModule);
//# sourceMappingURL=mcp.module.js.map