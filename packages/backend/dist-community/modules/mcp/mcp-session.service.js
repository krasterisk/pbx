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
var McpSessionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpSessionService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const mcp_tools_service_1 = require("./mcp-tools.service");
/**
 * McpSessionService — прямой JSON-RPC обработчик без MCP SDK state machine.
 *
 * Причина: SDK требует полный initialize handshake даже в stateless режиме.
 * Внешние клиенты могут слать tools/list и tools/call без предварительного handshake.
 *
 * Сессия (Mcp-Session-Id) привязана к тенанту, который её создал (D-28).
 *
 * Поддерживаемые методы:
 *   initialize   → capabilities
 *   tools/list   → список инструментов
 *   tools/call   → вызов инструмента
 */
let McpSessionService = McpSessionService_1 = class McpSessionService {
    toolsService;
    logger = new common_1.Logger(McpSessionService_1.name);
    sessions = new Map();
    constructor(toolsService) {
        this.toolsService = toolsService;
    }
    async handleRequest(req, res, vpbxUserUid) {
        const method = req.method.toUpperCase();
        this.logger.debug(`MCP ${method} for tenant ${vpbxUserUid}`);
        const incomingSessionId = this.readSessionId(req);
        const actor = req.user;
        const userUid = Number(actor?.sub ?? 0);
        const role = Number(actor?.level ?? 5);
        if (incomingSessionId) {
            const owner = this.sessions.get(incomingSessionId);
            if (!owner || owner.tenant !== vpbxUserUid || owner.userUid !== userUid) {
                throw new common_1.UnauthorizedException('MCP session is unknown or belongs to another identity');
            }
        }
        if (method === 'GET') {
            res.status(405).end(); // Server-initiated SSE is not supported; GET must not delete a session.
            return;
        }
        if (method === 'DELETE') {
            if (incomingSessionId) {
                this.sessions.delete(incomingSessionId);
            }
            res.status(200).json({ ok: true });
            return;
        }
        const body = req.body;
        if (!body?.method) {
            res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } });
            return;
        }
        if (body.method === 'initialize') {
            const sessionId = incomingSessionId || (0, crypto_1.randomUUID)();
            this.sessions.set(sessionId, { tenant: vpbxUserUid, userUid });
            res.setHeader('Mcp-Session-Id', sessionId);
        }
        res.setHeader('Content-Type', 'application/json');
        try {
            const result = await this.dispatch(body.method, body.params ?? {}, body.id ?? null, vpbxUserUid, { userUid, role, threadUid: 0 });
            res.json(result);
        }
        catch (err) {
            this.logger.error(`MCP dispatch error (tenant ${vpbxUserUid}): ${err.message}`);
            res.status(500).json({
                jsonrpc: '2.0',
                id: body.id ?? null,
                error: { code: -32000, message: err.message },
            });
        }
    }
    readSessionId(req) {
        const raw = req.headers['mcp-session-id'];
        const value = Array.isArray(raw) ? raw[0] : raw;
        return typeof value === 'string' ? value.trim() : '';
    }
    async dispatch(method, params, id, uid, actor) {
        // initialize — возвращаем capabilities без state
        if (method === 'initialize') {
            return {
                jsonrpc: '2.0', id,
                result: {
                    protocolVersion: '2025-03-26',
                    capabilities: { tools: {} },
                    serverInfo: { name: 'KrAsterisk PBX', version: '4.0.0' },
                },
            };
        }
        // notifications/initialized — клиент подтверждает init, отвечаем пустым
        if (method === 'notifications/initialized') {
            return { jsonrpc: '2.0', id, result: null };
        }
        // tools/list — список всех инструментов тенанта
        if (method === 'tools/list') {
            const tools = this.toolsService.getToolsList(uid);
            this.logger.log(`tools/list → ${tools.length} tools for tenant ${uid}`);
            return { jsonrpc: '2.0', id, result: { tools } };
        }
        // tools/call — вызов инструмента
        if (method === 'tools/call') {
            const toolName = params.name;
            const args = params.arguments ?? {};
            this.logger.log(`tools/call: ${toolName} for tenant ${uid}, user ${actor.userUid}`);
            const content = await this.toolsService.callTool(toolName, args, uid, actor);
            return { jsonrpc: '2.0', id, result: { content } };
        }
        return {
            jsonrpc: '2.0', id,
            error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
    getActiveSessions(tenant, userUid) {
        return Array.from(this.sessions.entries())
            .filter(([, owner]) => owner.tenant === tenant && owner.userUid === userUid)
            .map(([id, owner]) => ({ id, tenant: owner.tenant }));
    }
    onModuleDestroy() {
        this.sessions.clear();
        this.logger.log('McpSessionService destroyed');
    }
};
exports.McpSessionService = McpSessionService;
exports.McpSessionService = McpSessionService = McpSessionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mcp_tools_service_1.McpToolsService])
], McpSessionService);
//# sourceMappingURL=mcp-session.service.js.map