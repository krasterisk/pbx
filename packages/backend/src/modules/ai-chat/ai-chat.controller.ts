import {
    Controller,
    Post,
    Get,
    Put,
    Body,
    Req,
    Res,
    UseGuards,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsBoolean, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiChatService, ChatMessage } from './ai-chat.service';
import { PbxContextBuilderService } from './pbx-context-builder.service';
import { AiChatSettingsService } from './ai-chat-settings.service';
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

class UpdateAiChatSettingsDto {
    @IsBoolean()
    confirmDestructive: boolean;
}

/**
 * AiChatController — endpoints для AI-ассистента.
 *
 * Rate limits (через ThrottlerModule):
 *   - GET/settings endpoints: skip app-wide 'global' (and Auth 'default' if present) via @SkipThrottle({ default: true, global: true })
 *   - POST /message: 10 запросов/минуту (route-scoped @Throttle on app-wide 'global' profile)
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
        private readonly aiChatSettingsService: AiChatSettingsService,
        private readonly loggerService: LoggerService,
        private readonly config: ConfigService,
    ) {}

    /**
     * GET /api/ai-chat/settings
     * Per-tenant AI confirmation settings (D-20, D-25). Default OFF for tenants
     * with no row yet.
     */
    @ApiOperation({ summary: 'Get per-tenant AI confirmation settings' })
    @SkipThrottle({ default: true, global: true })
    @Get('settings')
    async getSettings(@Req() req: any) {
        return this.aiChatSettingsService.getSettings(req.user.vpbx_user_uid);
    }

    /**
     * PUT /api/ai-chat/settings
     * Updates per-tenant AI confirmation settings. Never touches cloud_settings
     * or other tenants — storage is per vpbx_user_uid (D-25).
     */
    @ApiOperation({ summary: 'Update per-tenant AI confirmation settings' })
    @SkipThrottle({ default: true, global: true })
    @Put('settings')
    async updateSettings(@Body() dto: UpdateAiChatSettingsDto, @Req() req: any) {
        return this.aiChatSettingsService.updateSettings(req.user.vpbx_user_uid, dto);
    }

    /**
     * GET /api/ai-chat/state
     * Returns current PBX configuration snapshot for the tenant.
     */
    @ApiOperation({ summary: 'Get PBX state snapshot for AI context' })
    @SkipThrottle({ default: true, global: true })
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
    @SkipThrottle({ default: true, global: true })
    @Get('models')
    async getModels() {
        return this.aiChatService.getAvailableModels();
    }

    /**
     * POST /api/ai-chat/message
     * Streams AI response via SSE.
     *
     * Rate limited: 10 requests/minute (route-scoped override on 'global' profile).
     *
     * SSE events (proxied from aiPBX ChatService):
     *   event: text        → chunk of text
     *   event: tool_call   → { name, arguments }
     *   event: tool_result → { name, result }
     *   event: done        → { totalLength }
     *   event: error       → error message string
     */
    @ApiOperation({ summary: 'Send message and get SSE streaming response' })
    @Throttle({ global: { limit: 10, ttl: 60000 } })
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
        // MCP health tracking — detect LLM hallucinating tool execution
        const collectedToolResults: string[] = [];

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

                // Collect tool_call events
                if (chunk.includes('event: tool_call')) {
                    const match = chunk.match(/data: (.+)/);
                    if (match) {
                        try {
                            const data = JSON.parse(match[1]);
                            collectedToolCalls.push(data.name ?? 'unknown');
                        } catch { /* ignore */ }
                    }
                }

                // Collect tool_result events (actual execution confirmation)
                if (chunk.includes('event: tool_result')) {
                    const match = chunk.match(/data: (.+)/);
                    if (match) {
                        try {
                            const data = JSON.parse(match[1]);
                            collectedToolResults.push(data.name ?? 'unknown');
                        } catch { /* ignore */ }
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

        // ── Hallucination detection ───────────────────────────────────────────
        // If LLM mentioned tool calls in text but no tool_result events arrived
        // → MCP tools were disabled or call failed silently
        const mcpEnabled = !!(
            this.config.get('KRASTERISK_PUBLIC_URL') &&
            this.config.get('KRASTERISK_SERVICE_TOKEN')
        );

        if (!mcpEnabled) {
            this.logger.warn(
                `[AI HALLUCINATION RISK] MCP disabled for tenant ${userUid}. ` +
                `Message: "${dto.message.slice(0, 80)}". ` +
                `LLM has no tools — responses about PBX changes are SIMULATED.`,
            );
        } else if (collectedToolCalls.length > 0 && collectedToolResults.length === 0) {
            // LLM signalled tool calls but got no results back
            this.logger.warn(
                `[AI HALLUCINATION RISK] tenant=${userUid}: ` +
                `tool_calls declared [${collectedToolCalls.join(', ')}] ` +
                `but 0 tool_results received. MCP call may have failed silently.`,
            );
        }

        // ── Audit log ─────────────────────────────────────────────────────────
        const durationMs = Date.now() - startedAt;
        const toolSummary = collectedToolCalls.length > 0
            ? `calls=[${collectedToolCalls.join(',')}] results=[${collectedToolResults.join(',')}]`
            : 'no_tools';

        this.loggerService.logAction(
            userId,
            'ai_chat',
            'ai_dialog',
            null,
            userUid,
            `"${dto.message.slice(0, 100)}" → ${toolSummary} | ${durationMs}ms | mcp=${mcpEnabled ? 'on' : 'OFF'}`,
            hasError ? 'error' : 'success',
        ).catch(e => this.logger.warn(`Audit log failed: ${e.message}`));
    }
}
