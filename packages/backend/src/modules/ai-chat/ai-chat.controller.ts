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
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PbxContextBuilderService } from './pbx-context-builder.service';
import { AiChatSettingsService } from './ai-chat-settings.service';
import { LoggerService } from '../logger/logger.service';
import { PbxAgentLoopService } from './pbx-agent-loop.service';
import { PbxAgentThreadService } from './pbx-agent-thread.service';
import { DEFAULT_SSE_HEARTBEAT_MS, SseStreamSession } from './agent-sse.util';

const BODY_IDENTITY_KEYS = [
    'tenantUid',
    'authorUid',
    'role',
    'tenant',
    'author',
    'vpbxUserUid',
    'vpbx_user_uid',
    'user_uid',
];

class SendMessageDto {
    @IsString()
    message: string;

    @IsOptional()
    @IsInt()
    threadUid?: number;
}

class UpdateAiChatSettingsDto {
    @IsBoolean()
    confirmDestructive: boolean;
}

/**
 * AiChatController — in-process agent turn (D-06).
 *
 * Rate limits:
 *   - GET/settings: skip app-wide throttles
 *   - POST /message: 10 requests/minute
 */
@ApiTags('AI Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-chat')
export class AiChatController {
    private readonly logger = new Logger(AiChatController.name);

    constructor(
        private readonly loop: PbxAgentLoopService,
        private readonly threads: PbxAgentThreadService,
        private readonly contextBuilder: PbxContextBuilderService,
        private readonly aiChatSettingsService: AiChatSettingsService,
        private readonly loggerService: LoggerService,
    ) {}

    @ApiOperation({ summary: 'Get per-tenant AI confirmation settings' })
    @SkipThrottle({ default: true, global: true })
    @Get('settings')
    async getSettings(@Req() req: any) {
        return this.aiChatSettingsService.getSettings(req.user.vpbx_user_uid);
    }

    @ApiOperation({ summary: 'Update per-tenant AI confirmation settings' })
    @SkipThrottle({ default: true, global: true })
    @Put('settings')
    async updateSettings(@Body() dto: UpdateAiChatSettingsDto, @Req() req: any) {
        return this.aiChatSettingsService.updateSettings(req.user.vpbx_user_uid, dto);
    }

    @ApiOperation({ summary: 'Get PBX state snapshot for AI context' })
    @SkipThrottle({ default: true, global: true })
    @Get('state')
    async getState(@Req() req: any) {
        return this.contextBuilder.buildState(req.user.vpbx_user_uid);
    }

    /** Tenants do not pick a model (D-07). Kept so existing clients stay on 200. */
    @ApiOperation({ summary: 'Get available AI models' })
    @SkipThrottle({ default: true, global: true })
    @Get('models')
    async getModels() {
        return [];
    }

    /**
     * POST /api/ai-chat/message
     * Streams the in-process turn. Tenant, author and role come from the token.
     */
    @ApiOperation({ summary: 'Send message and get SSE streaming response' })
    @Throttle({ global: { limit: 10, ttl: 60000 } })
    @Post('message')
    async sendMessage(
        @Body() dto: SendMessageDto,
        @Req() req: any,
        @Res() res: Response,
    ) {
        this.rejectBodyIdentity(req.body ?? dto);

        const tenantUid: number = req.user.vpbx_user_uid;
        const authorUid: number = req.user.sub || req.user.id || 0;
        const role: number = Number(req.user.level ?? 1);
        const startedAt = Date.now();

        const conversation = dto.threadUid
            ? await this.threads.getThread(dto.threadUid, tenantUid, authorUid)
            : await this.threads.createThread(tenantUid, authorUid);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const abortController = new AbortController();
        req.on('close', () => abortController.abort());

        const session = new SseStreamSession((chunk) => res.write(chunk), DEFAULT_SSE_HEARTBEAT_MS);
        session.startHeartbeat();

        let hasError = false;
        try {
            for await (const event of this.loop.runTurn(dto.message, { uid: conversation.uid }, {
                tenantUid,
                authorUid,
                role,
                signal: abortController.signal,
            })) {
                if (abortController.signal.aborted) break;
                session.emit(event.name, event.data);
                if (event.name === 'error') hasError = true;
            }
        } catch (err: any) {
            hasError = true;
            if (!abortController.signal.aborted) {
                session.emit('error', err?.message ?? 'Unknown error');
            }
        } finally {
            session.stop();
            res.end();
        }

        const durationMs = Date.now() - startedAt;
        this.loggerService.logAction(
            authorUid,
            'ai_chat',
            'ai_dialog',
            conversation.uid,
            tenantUid,
            `"${dto.message.slice(0, 100)}" | ${durationMs}ms`,
            hasError ? 'error' : 'success',
        ).catch((error) => this.logger.warn(`Audit log failed: ${error.message}`));
    }

    private rejectBodyIdentity(body: Record<string, unknown>): void {
        for (const key of BODY_IDENTITY_KEYS) {
            if (Object.prototype.hasOwnProperty.call(body, key)) {
                throw new BadRequestException('tenant, author and role are taken from the token');
            }
        }
    }
}
