import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response } from 'express';
import { McpToolsService } from './mcp-tools.service';
import { randomUUID } from 'crypto';

/**
 * McpSessionService — управляет Streamable HTTP сессиями MCP клиентов.
 *
 * Использует актуальный StreamableHTTPServerTransport (SDK 1.x) вместо
 * deprecated SSEServerTransport.
 *
 * Streamable HTTP — единый endpoint /api/mcp:
 *   GET  /api/mcp  — SSE-поток событий от сервера (notifications)
 *   POST /api/mcp  — JSON-RPC запросы от клиента (с sessionId в header)
 *   DELETE /api/mcp — закрыть сессию
 *
 * Изоляция тенантов: каждая авторизованная сессия получает свой McpServer
 * с инструментами, привязанными к vpbxUserUid.
 */
@Injectable()
export class McpSessionService implements OnModuleDestroy {
    private readonly logger = new Logger(McpSessionService.name);
    private readonly sessions = new Map<string, {
        transport: StreamableHTTPServerTransport;
        server: McpServer;
        vpbxUserUid: number;
        createdAt: Date;
    }>();

    constructor(private readonly toolsService: McpToolsService) {}

    /**
     * Обрабатывает GET/POST/DELETE запросы к /api/mcp.
     *
     * Streamable HTTP transport сам определяет тип запроса:
     * - GET без sessionId → инициализация, возвращает sessionId в заголовке
     * - POST с Mcp-Session-Id → JSON-RPC сообщение в существующую сессию
     * - POST без sessionId → инициализация + первый запрос
     * - DELETE → закрыть сессию
     */
    async handleRequest(
        req: Request,
        res: Response,
        vpbxUserUid: number,
    ): Promise<void> {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        // Существующая сессия
        if (sessionId && this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            // Проверяем что сессия принадлежит этому тенанту (безопасность)
            if (session.vpbxUserUid !== vpbxUserUid) {
                res.status(403).json({ error: 'Session belongs to different tenant' });
                return;
            }
            await session.transport.handleRequest(req as any, res as any, req.body);
            return;
        }

        // Новая сессия (инициализация)
        if (!sessionId && req.method === 'POST') {
            await this.createSession(req, res, vpbxUserUid);
            return;
        }

        // GET без sessionId — standalone SSE (polling/notifications)
        if (!sessionId && req.method === 'GET') {
            await this.createSession(req, res, vpbxUserUid);
            return;
        }

        // Неизвестный sessionId
        if (sessionId) {
            this.logger.warn(`MCP session not found: ${sessionId}`);
            res.status(404).json({ error: `Session not found: ${sessionId}` });
            return;
        }

        res.status(400).json({ error: 'Invalid MCP request' });
    }

    /**
     * Создаёт новый McpServer + StreamableHTTPServerTransport для тенанта.
     */
    private async createSession(
        req: Request,
        res: Response,
        vpbxUserUid: number,
    ): Promise<void> {
        this.logger.log(`Creating new MCP session for tenant ${vpbxUserUid}`);

        // Создаём изолированный McpServer для этого тенанта
        const mcpServer = new McpServer(
            { name: 'KrAsterisk PBX', version: '4.0.0' },
            { capabilities: { tools: {} } },
        );

        // Регистрируем все инструменты для тенанта
        this.toolsService.registerAll(mcpServer, vpbxUserUid);

        // StreamableHTTPServerTransport — stateful режим, sessionId генерируется автоматически
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
        });

        await mcpServer.connect(transport);

        transport.onclose = () => {
            const id = transport.sessionId;
            if (id) {
                this.logger.log(`MCP session closed: ${id} (tenant ${vpbxUserUid})`);
                this.sessions.delete(id);
            }
        };

        transport.onerror = (err) => {
            this.logger.error(`MCP transport error (tenant ${vpbxUserUid}): ${err.message}`);
        };

        // Обрабатываем текущий запрос (инициализация)
        await transport.handleRequest(req as any, res as any, req.body);

        // Сохраняем сессию по sessionId из заголовка ответа
        // sessionId появится после handleRequest (transport генерирует его)
        const id = transport.sessionId;
        if (id) {
            this.sessions.set(id, {
                transport,
                server: mcpServer,
                vpbxUserUid,
                createdAt: new Date(),
            });
            this.logger.log(`MCP session created: ${id} (tenant ${vpbxUserUid})`);
        }
    }

    /**
     * Возвращает информацию об активных сессиях (для отладки).
     */
    getActiveSessions(): Array<{ sessionId: string; vpbxUserUid: number; createdAt: string }> {
        return Array.from(this.sessions.entries()).map(([id, s]) => ({
            sessionId: id,
            vpbxUserUid: s.vpbxUserUid,
            createdAt: s.createdAt.toISOString(),
        }));
    }

    onModuleDestroy() {
        for (const [id, session] of this.sessions.entries()) {
            session.server.close().catch(() => {});
            this.sessions.delete(id);
        }
        this.logger.log('All MCP sessions closed');
    }
}
