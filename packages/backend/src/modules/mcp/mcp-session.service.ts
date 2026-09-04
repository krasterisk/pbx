import { Injectable, Logger, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { McpToolsService } from './mcp-tools.service';

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
    private readonly sessions = new Map<string, number>();

    constructor(private readonly toolsService: McpToolsService) {}

    async handleRequest(req: Request, res: Response, vpbxUserUid: number): Promise<void> {
        const method = req.method.toUpperCase();
        this.logger.debug(`MCP ${method} for tenant ${vpbxUserUid}`);

        const incomingSessionId = this.readSessionId(req);
        if (incomingSessionId) {
            const owner = this.sessions.get(incomingSessionId);
            if (owner !== undefined && owner !== vpbxUserUid) {
                throw new UnauthorizedException('MCP session belongs to another tenant');
            }
        }

        if (method === 'DELETE' || method === 'GET') {
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
            this.sessions.set(sessionId, vpbxUserUid);
            res.setHeader('Mcp-Session-Id', sessionId);
        }

        res.setHeader('Content-Type', 'application/json');

        try {
            const result = await this.dispatch(body.method, body.params ?? {}, body.id ?? null, vpbxUserUid);
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

    private async dispatch(method: string, params: any, id: any, uid: number): Promise<object> {
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
            const toolName: string = params.name;
            const args: Record<string, any> = params.arguments ?? {};
            this.logger.log(`tools/call: ${toolName} for tenant ${uid}, args: ${JSON.stringify(args)}`);

            const content = await this.toolsService.callTool(toolName, args, uid);
            return { jsonrpc: '2.0', id, result: { content } };
        }

        return {
            jsonrpc: '2.0', id,
            error: { code: -32601, message: `Method not found: ${method}` },
        };
    }

    getActiveSessions() {
        return Array.from(this.sessions.entries()).map(([id, tenant]) => ({ id, tenant }));
    }

    onModuleDestroy() {
        this.sessions.clear();
        this.logger.log('McpSessionService destroyed');
    }
}
