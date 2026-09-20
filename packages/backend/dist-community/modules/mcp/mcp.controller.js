"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var McpController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const mcp_session_service_1 = require("./mcp-session.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
/**
 * McpController — HTTP endpoint для MCP Streamable HTTP транспорта.
 *
 * Протокол: Streamable HTTP (актуальный стандарт MCP SDK 1.x):
 *
 *   GET    /api/mcp  — SSE-поток уведомлений от сервера (опционально)
 *   POST   /api/mcp  — JSON-RPC запросы (инициализация + tool calls)
 *   DELETE /api/mcp  — закрыть сессию
 *
 * SessionId передаётся в заголовке `Mcp-Session-Id` (не в query params).
 * Первый POST без заголовка создаёт новую сессию и возвращает sessionId
 * в ответном заголовке. Сессия привязана к тенанту из JWT (D-28).
 *
 * Аутентификация: только пользовательский JWT. Тенант берётся из токена.
 */
let McpController = McpController_1 = class McpController {
    sessionService;
    logger = new common_1.Logger(McpController_1.name);
    constructor(sessionService) {
        this.sessionService = sessionService;
    }
    /**
     * ALL /api/mcp — единый endpoint Streamable HTTP MCP транспорта.
     *
     * Обрабатывает GET (SSE), POST (JSON-RPC), DELETE (close session).
     * Transport сам определяет тип по методу и заголовкам.
     */
    async handleMcp(req, res) {
        const vpbxUserUid = req.user.vpbx_user_uid;
        this.logger.debug(`MCP ${req.method} from tenant ${vpbxUserUid}`);
        await this.sessionService.handleRequest(req, res, vpbxUserUid);
    }
    /**
     * GET /api/mcp/sessions — список активных MCP сессий (debug).
     */
    getSessions(req) {
        const sessions = this.sessionService.getActiveSessions(req.user.vpbx_user_uid, req.user.sub);
        return { count: sessions.length, sessions };
    }
};
exports.McpController = McpController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'MCP Streamable HTTP endpoint (GET/POST/DELETE)' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.All)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], McpController.prototype, "handleMcp", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List active MCP sessions (debug)' }),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('sessions'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], McpController.prototype, "getSessions", null);
exports.McpController = McpController = McpController_1 = __decorate([
    (0, swagger_1.ApiTags)('MCP Server'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('mcp'),
    __metadata("design:paramtypes", [mcp_session_service_1.McpSessionService])
], McpController);
//# sourceMappingURL=mcp.controller.js.map