import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Request, Response } from 'express';
import { McpToolsService } from './mcp-tools.service';

/**
 * McpSessionService — прямой JSON-RPC обработчик без MCP SDK state machine.
 *
 * Причина: SDK требует полный initialize handshake даже в stateless режиме.
 * aiPBX использует ephemeral подключения: каждый tools/list и tools/call —
 * отдельный HTTP запрос без sessionId.
 *
 * Поддерживаемые методы:
 *   initialize   → capabilities
 *   tools/list   → список инструментов
 *   tools/call   → вызов инструмента
 */
@Injectable()
export class McpSessionService implements OnModuleDestroy {
    private readonly logger = new Logger(McpSessionService.name);

    constructor(private readonly toolsService: McpToolsService) {}

    async handleRequest(req: Request, res: Response, vpbxUserUid: number): Promise<void> {
        const method = req.method.toUpperCase();
        this.logger.debug(`MCP ${method} for tenant ${vpbxUserUid}`);

        if (method === 'DELETE' || method === 'GET') {
            res.status(200).json({ ok: true });
            return;
        }

        const body = req.body;
        if (!body?.method) {
            res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } });
            return;
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
        return [{ info: 'Stateless direct JSON-RPC mode — no persistent sessions' }];
    }

    onModuleDestroy() {
        this.logger.log('McpSessionService destroyed');
    }
}
