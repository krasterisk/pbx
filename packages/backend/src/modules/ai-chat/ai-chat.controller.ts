import {
    Controller,
    Post,
    Get,
    Body,
    Req,
    Res,
    UseGuards,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiChatService, ChatMessage } from './ai-chat.service';
import { PbxContextBuilderService } from './pbx-context-builder.service';
import { LoggerService } from '../logger/logger.service';

class ChatMessageDto {
    @IsIn(['user', 'assistant', 'system'])
    role: 'user' | 'assistant' | 'system';

    @IsString()
    content: string;
}

class SendMessageDto {
    @IsString()
    message: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ChatMessageDto)
    history?: ChatMessage[];
}

/**
 * AiChatController — endpoints для AI-ассистента.
 *
 * Rate limits (через ThrottlerModule):
 *   - POST /message: 10 запросов/минуту (throttle name 'ai')
 *   - GET endpoints: без ограничений
 *
 * Audit log: все tool calls, выполненные через AI, логируются в ActionLog.
 */
@ApiTags('AI Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-chat')
export class AiChatController {
    private readonly logger = new Logger(AiChatController.name);

    constructor(
        private readonly aiChatService: AiChatService,
        private readonly contextBuilder: PbxContextBuilderService,
        private readonly loggerService: LoggerService,
    ) {}

    /**
     * GET /api/ai-chat/state
     * Returns current PBX configuration snapshot for the tenant.
     */
    @ApiOperation({ summary: 'Get PBX state snapshot for AI context' })
    @SkipThrottle()
    @Get('state')
    async getState(@Req() req: any) {
        const userUid: number = req.user.vpbx_user_uid;
        return this.contextBuilder.buildState(userUid);
    }

    /**
     * GET /api/ai-chat/models
     * Returns list of available LLM models from aiPBX.
     */
    @ApiOperation({ summary: 'Get available AI models' })
    @SkipThrottle()
    @Get('models')
    async getModels() {
        return this.aiChatService.getAvailableModels();
    }

    /**
     * POST /api/ai-chat/message
     * Streams AI response via SSE.
     *
     * Rate limited: 10 requests/minute per user (throttle name 'ai').
     *
     * SSE events (proxied from aiPBX ChatService):
     *   event: text        → chunk of text
     *   event: tool_call   → { name, arguments }
     *   event: tool_result → { name, result }
     *   event: done        → { totalLength }
     *   event: error       → error message string
     */
    @ApiOperation({ summary: 'Send message and get SSE streaming response' })
    @Throttle({ ai: { limit: 10, ttl: 60000 } })
    @Post('message')
    async sendMessage(
        @Body() dto: SendMessageDto,
        @Req() req: any,
        @Res() res: Response,
    ) {
        const userUid: number = req.user.vpbx_user_uid;
        const userId: number = req.user.sub || req.user.id || 0;
        const startedAt = Date.now();

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const abortController = new AbortController();
        req.on('close', () => abortController.abort());

        const collectedToolCalls: string[] = [];
        let hasError = false;

        try {
            const stream = this.aiChatService.streamFromAiPbx(
                dto.message,
                dto.history ?? [],
                userUid,
                abortController.signal,
            );

            for await (const chunk of stream) {
                if (abortController.signal.aborted) break;
                res.write(chunk);

                // Collect tool_call events for audit log
                if (chunk.includes('event: tool_call')) {
                    const match = chunk.match(/data: (.+)/);
                    if (match) {
                        try {
                            const data = JSON.parse(match[1]);
                            collectedToolCalls.push(data.name ?? 'unknown');
                        } catch { /* ignore parse errors */ }
                    }
                }
            }
        } catch (err: any) {
            hasError = true;
            if (!abortController.signal.aborted) {
                res.write(`event: error\ndata: ${JSON.stringify(err?.message ?? 'Unknown error')}\n\n`);
            }
        } finally {
            res.end();
        }

        // Audit log — асинхронно, не блокируем ответ
        const durationMs = Date.now() - startedAt;
        const summary = collectedToolCalls.length > 0
            ? `tools: ${collectedToolCalls.join(', ')} | ${durationMs}ms`
            : `${durationMs}ms`;

        this.loggerService.logAction(
            userId,
            'ai_chat',
            'ai_dialog',
            null,
            userUid,
            `"${dto.message.slice(0, 120)}" → ${summary}`,
            hasError ? 'error' : 'success',
        ).catch(e => this.logger.warn(`Audit log failed: ${e.message}`));
    }
}
