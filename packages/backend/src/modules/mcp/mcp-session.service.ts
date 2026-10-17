import { Injectable, Logger, OnModuleDestroy, Optional, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { McpToolsService } from './mcp-tools.service';
import { McpAutodialCatalogService } from './mcp-autodial-catalog.service';

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
@Injectable()
export class McpSessionService implements OnModuleDestroy {
    private readonly logger = new Logger(McpSessionService.name);
    private readonly sessions = new Map<string, { tenant: number; userUid: number; credential: string; expires: number }>();

    constructor(private readonly toolsService: McpToolsService, @Optional() private readonly catalog?: McpAutodialCatalogService) {}

    async handleRequest(req: Request, res: Response, vpbxUserUid: number): Promise<void> {
        const method = req.method.toUpperCase();
        this.logger.debug(`MCP ${method} for tenant ${vpbxUserUid}`);

        const incomingSessionId = this.readSessionId(req);
        const actor = (req as Request & { user?: { sub?: number; level?: number; integration_key_uid?: string; integration_scopes?: string[] } }).user;
        const userUid = Number(actor?.sub ?? 0);
        const role = Number(actor?.level ?? 5);
        const credential = actor?.integration_key_uid ? `key:${actor.integration_key_uid}` : `user:${userUid}`;
        for (const [id, session] of this.sessions) if (session.expires <= Date.now()) this.sessions.delete(id);
        if (incomingSessionId) {
            const owner = this.sessions.get(incomingSessionId);
            if (!owner || owner.tenant !== vpbxUserUid || owner.userUid !== userUid || owner.credential !== credential) {
                throw new UnauthorizedException('MCP session is unknown or belongs to another identity');
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
            const sessionId = incomingSessionId || randomUUID();
            if (!incomingSessionId && this.sessions.size >= 10000) { res.status(503).end(); return; }
            this.sessions.set(sessionId, { tenant: vpbxUserUid, userUid, credential, expires: Date.now() + 3600000 });
            res.setHeader('Mcp-Session-Id', sessionId);
        }

        res.setHeader('Content-Type', 'application/json');

        try {
            const result = await this.dispatch(body.method, body.params ?? {}, body.id ?? null, vpbxUserUid, { userUid, role, threadUid: 0 }, actor?.integration_scopes);
            res.json(result);
        } catch (err: any) {
            this.logger.error(`MCP dispatch error (tenant ${vpbxUserUid}): ${err.message}`);
            res.status(500).json({
                jsonrpc: '2.0',
                id: body.id ?? null,
                error: { code: -32000, message: err.message },
            });
        }
    }

    private readSessionId(req: Request): string {
        const raw = req.headers['mcp-session-id'];
        const value = Array.isArray(raw) ? raw[0] : raw;
        return typeof value === 'string' ? value.trim() : '';
    }

    private async dispatch(method: string, params: any, id: any, uid: number, actor: { userUid: number; role: number; threadUid: number }, scopes?: string[]): Promise<object> {
        // initialize — возвращаем capabilities без state
        if (method === 'initialize') {
            return {
                jsonrpc: '2.0', id,
                result: {
                    protocolVersion: '2025-03-26',
                    capabilities: { tools: {}, ...(this.catalog ? { resources: {}, prompts: {} } : {}) },
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
            const tools = this.toolsService.getToolsList(uid).filter((tool) => !scopes || this.allowed(tool.name, scopes));
            this.logger.log(`tools/list → ${tools.length} tools for tenant ${uid}`);
            return { jsonrpc: '2.0', id, result: { tools } };
        }

        // tools/call — вызов инструмента
        if (method === 'tools/call') {
            const toolName: string = params.name;
            const args: Record<string, any> = params.arguments ?? {};
            if (scopes && !this.allowed(toolName, scopes)) return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Tool is outside this API key scope' } };
            if (scopes && toolName === 'propose_plan' && (!Array.isArray(args.steps) || !args.steps.length || args.steps.length > 30
                || args.steps.some((step: any) => !step || typeof step.tool !== 'string' || step.tool === 'propose_plan'
                  || !this.allowed(step.tool, scopes) || !this.toolsService.isMutationTool(step.tool))))
                return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Every plan step must be an allowed autodial proposal' } };
            this.logger.log(`tools/call: ${toolName} for tenant ${uid}, user ${actor.userUid}`);

            const content = await this.toolsService.callTool(toolName, args, uid, actor);
            return { jsonrpc: '2.0', id, result: { content } };
        }

        if (this.catalog && ['resources/list', 'resources/templates/list', 'resources/read', 'prompts/list', 'prompts/get'].includes(method)) {
            if (scopes && !scopes.includes('autodial:read')) return { jsonrpc: '2.0', id, error: { code: -32602, message: 'autodial:read scope required' } };
            const result = method === 'resources/list' ? this.catalog.list()
              : method === 'resources/templates/list' ? this.catalog.templates()
              : method === 'resources/read' ? await this.catalog.read(params.uri, uid, actor)
              : method === 'prompts/list' ? this.catalog.prompts() : this.catalog.prompt(params.name, params.arguments);
            return { jsonrpc: '2.0', id, result };
        }

        return {
            jsonrpc: '2.0', id,
            error: { code: -32601, message: `Method not found: ${method}` },
        };
    }

    private allowed(name: unknown, scopes: string[]): boolean {
        if (name === 'propose_plan') return scopes.includes('autodial:proposals:write');
        if (typeof name !== 'string' || !name.includes('_autodial_')) return false;
        const read = /^(get|list|describe|find|suggest)_/.test(name);
        // Unknown names cannot gain write access simply by looking like a read operation.
        const tools = this.toolsService.getToolsList(0);
        if (!tools.some((tool) => tool.name === name)) return false;
        return scopes.includes(read && !this.toolsService.isMutationTool(name) ? 'autodial:read' : 'autodial:proposals:write');
    }

    getActiveSessions(tenant?: number, userUid?: number) {
        return Array.from(this.sessions.entries())
            .filter(([, owner]) => owner.tenant === tenant && owner.userUid === userUid)
            .map(([id, owner]) => ({ id, tenant: owner.tenant }));
    }

    onModuleDestroy() {
        this.sessions.clear();
        this.logger.log('McpSessionService destroyed');
    }
}
