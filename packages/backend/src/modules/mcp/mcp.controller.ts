import { Controller, All, Get, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { McpSessionService } from './mcp-session.service';
import { JwtOrServiceTokenGuard } from '../auth/jwt-or-service-token.guard';

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
 * в ответном заголовке.
 *
 * Аутентификация: JWT пользователя ИЛИ service token
 * (Authorization: Bearer <KRASTERISK_SERVICE_TOKEN> + X-Vpbx-User-Uid: <uid>)
 */
@ApiTags('MCP Server')
@ApiBearerAuth()
@Controller('mcp')
export class McpController {
    private readonly logger = new Logger(McpController.name);

    constructor(private readonly sessionService: McpSessionService) {}

    /**
     * ALL /api/mcp — единый endpoint Streamable HTTP MCP транспорта.
     *
     * Обрабатывает GET (SSE), POST (JSON-RPC), DELETE (close session).
     * Transport сам определяет тип по методу и заголовкам.
     */
    @ApiOperation({ summary: 'MCP Streamable HTTP endpoint (GET/POST/DELETE)' })
    @UseGuards(JwtOrServiceTokenGuard)
    @All()
    async handleMcp(
        @Req() req: Request & { user: any },
        @Res() res: Response,
    ): Promise<void> {
        const vpbxUserUid = req.user.vpbx_user_uid;
        this.logger.debug(`MCP ${req.method} from tenant ${vpbxUserUid}`);
        await this.sessionService.handleRequest(req, res, vpbxUserUid);
    }

    /**
     * GET /api/mcp/sessions — список активных MCP сессий (debug).
     */
    @ApiOperation({ summary: 'List active MCP sessions (debug)' })
    @UseGuards(JwtOrServiceTokenGuard)
    @Get('sessions')
    getSessions(@Req() req: Request & { user: any }) {
        const sessions = this.sessionService.getActiveSessions();
        return { count: sessions.length, sessions };
    }
}
