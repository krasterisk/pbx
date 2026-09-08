import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Body,
    Param,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
    Req,
    Res,
    UseGuards,
    Logger,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { InjectModel } from '@nestjs/sequelize';
import type { AgentItemVisibility } from '@krasterisk/shared';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PbxContextBuilderService } from './pbx-context-builder.service';
import { AiChatSettingsService } from './ai-chat-settings.service';
import { LoggerService } from '../logger/logger.service';
import { CONTINUE_AFTER_APPLY_PROMPT, PbxAgentLoopService } from './pbx-agent-loop.service';
import { PbxAgentThreadService } from './pbx-agent-thread.service';
import { AiProvidersService } from '../ai-agents/ai-providers.service';
import { AgentProposal } from './models/agent-proposal.model';
import { toProposalView, type AgentProposalView } from './dto/agent-diff.dto';
import { AgentThread } from './models/agent-thread.model';
import { AgentThreadMessage } from './models/agent-thread-message.model';
import { DEFAULT_SSE_HEARTBEAT_MS, SseStreamSession } from './agent-sse.util';
import { buildTimeline, type TimelineProposalRef } from './agent-timeline.util';
import { PbxWorkflowRunnerService, type WorkflowPlanView } from './pbx-workflow-runner.service';

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

    @IsOptional()
    @IsString()
    locale?: string;
}

class UpdateAiChatSettingsDto {
    @IsBoolean()
    confirmDestructive: boolean;
}

class UpdateDefaultProviderDto {
    @IsInt()
    providerUid: number;
}

const ADMIN_LEVELS = new Set([0, 1]);

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
        private readonly providers: AiProvidersService,
        private readonly loggerService: LoggerService,
        @InjectModel(AgentProposal) private readonly proposals: typeof AgentProposal,
        private readonly workflows: PbxWorkflowRunnerService,
    ) {}

    @ApiOperation({ summary: 'List the caller\'s conversations (tenant + author)' })
    @SkipThrottle({ default: true, global: true })
    @Get('threads')
    async listThreads(@Req() req: any) {
        const { tenantUid, authorUid } = this.identityFromToken(req);
        const rows = await this.threads.listThreads(tenantUid, authorUid);
        return rows.map((row) => this.toThreadJson(row));
    }

    @ApiOperation({ summary: 'Create an empty conversation' })
    @Post('threads')
    async createThread(@Req() req: any) {
        const { tenantUid, authorUid } = this.identityFromToken(req);
        const row = await this.threads.createThread(tenantUid, authorUid);
        return this.toThreadJson(row);
    }

    @ApiOperation({ summary: 'Get one conversation and its timeline' })
    @SkipThrottle({ default: true, global: true })
    @Get('threads/:uid')
    async getThread(@Param('uid', ParseIntPipe) uid: number, @Req() req: any) {
        const { tenantUid, authorUid, role } = this.identityFromToken(req);
        const thread = await this.threads.getThread(uid, tenantUid, authorUid);
        const messages = await this.threads.listMessages(uid, tenantUid, authorUid);
        const proposalById = await this.proposalViewsFor(messages, tenantUid, authorUid);
        const workflowById = await this.workflowViewsFor(
            messages,
            tenantUid,
            authorUid,
            role,
            new Set(proposalById.keys()),
        );
        const proposalRefs = new Map<string, TimelineProposalRef>();
        for (const id of proposalById.keys()) {
            proposalRefs.set(id, { proposalId: id, card: 'single' });
        }
        for (const id of workflowById.keys()) {
            proposalRefs.set(id, { proposalId: id, card: 'workflow' });
        }
        const timeline = buildTimeline(
            messages.filter((row) => row.visibility !== 'internal'),
            { proposals: proposalRefs },
        );
        return {
            ...this.toThreadJson(thread),
            timeline,
            cards: this.cardsFor(messages, proposalById, workflowById),
        };
    }

    @ApiOperation({ summary: 'Continue the turn after the user applied a card' })
    @Throttle({ global: { limit: 10, ttl: 60000 } })
    @Post('threads/:uid/continue')
    async continueThread(@Param('uid', ParseIntPipe) uid: number, @Req() req: any, @Res() res: Response) {
        this.rejectBodyIdentity(req.body ?? {});
        const { tenantUid, authorUid } = this.identityFromToken(req);
        await this.threads.getThread(uid, tenantUid, authorUid);
        await this.streamTurn(CONTINUE_AFTER_APPLY_PROMPT, uid, req, res, { visibility: 'internal' });
    }

    @ApiOperation({ summary: 'Delete a conversation the caller owns' })
    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete('threads/:uid')
    async deleteThread(@Param('uid', ParseIntPipe) uid: number, @Req() req: any) {
        const { tenantUid, authorUid } = this.identityFromToken(req);
        await this.threads.deleteThread(uid, tenantUid, authorUid);
    }

    @ApiOperation({ summary: 'Provider the chat agent uses (admin)' })
    @SkipThrottle({ default: true, global: true })
    @Get('default-provider')
    async getDefaultProvider(@Req() req: any) {
        this.assertAdmin(req);
        const tenantUid = Number(req.user.vpbx_user_uid);
        const providerUid = await this.aiChatSettingsService.getDefaultProviderUid(tenantUid);
        return { providerUid };
    }

    @ApiOperation({ summary: 'Choose the provider the chat agent uses (admin)' })
    @SkipThrottle({ default: true, global: true })
    @Put('default-provider')
    async setDefaultProvider(@Body() dto: UpdateDefaultProviderDto, @Req() req: any) {
        this.assertAdmin(req);
        const tenantUid = Number(req.user.vpbx_user_uid);
        await this.providers.findOne(dto.providerUid, tenantUid);
        const providerUid = await this.aiChatSettingsService.setDefaultProviderUid(tenantUid, dto.providerUid);
        return { providerUid };
    }

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

        const { tenantUid, authorUid } = this.identityFromToken(req);
        const conversation = dto.threadUid
            ? await this.threads.getThread(dto.threadUid, tenantUid, authorUid)
            : await this.threads.createThread(tenantUid, authorUid);

        await this.streamTurn(dto.message, conversation.uid, req, res, {
            visibility: 'public',
            locale: this.resolveLocale(dto.locale, req),
        });
    }

    private assertAdmin(req: { user?: { level?: number } }) {
        if (!ADMIN_LEVELS.has(Number(req.user?.level))) {
            throw new ForbiddenException('Admin access required to choose the chat provider');
        }
    }

    private identityFromToken(req: { user?: { vpbx_user_uid?: number; sub?: number; id?: number; level?: number } }) {
        return {
            tenantUid: Number(req.user?.vpbx_user_uid),
            authorUid: Number(req.user?.sub || req.user?.id || 0),
            role: Number(req.user?.level ?? 1),
        };
    }

    private toIso(value: Date | string | null | undefined): string | null {
        if (!value) return null;
        return value instanceof Date ? value.toISOString() : String(value);
    }

    private toThreadJson(thread: AgentThread) {
        return {
            uid: thread.uid,
            title: thread.title,
            status: thread.status,
            last_message_at: this.toIso(thread.last_message_at),
            created_at: this.toIso(thread.created_at) ?? '',
            updated_at: this.toIso(thread.updated_at) ?? '',
        };
    }

    private async streamTurn(
        message: string,
        threadUid: number,
        req: { user?: { vpbx_user_uid?: number; sub?: number; id?: number; level?: number }; on?: (event: string, listener: () => void) => void; headers?: Record<string, unknown> },
        res: Response,
        opts: { visibility: AgentItemVisibility; locale?: string },
    ) {
        const { tenantUid, authorUid, role } = this.identityFromToken(req);
        const startedAt = Date.now();

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const abortController = new AbortController();
        req.on?.('close', () => abortController.abort());

        const session = new SseStreamSession((chunk) => res.write(chunk), DEFAULT_SSE_HEARTBEAT_MS);
        session.startHeartbeat();

        let hasError = false;
        try {
            for await (const event of this.loop.runTurn(message, { uid: threadUid }, {
                tenantUid,
                authorUid,
                role,
                locale: opts.locale ?? this.resolveLocale(undefined, req),
                signal: abortController.signal,
                userVisibility: opts.visibility,
            })) {
                if (abortController.signal.aborted) break;
                session.emit(event.name, event.data);
                if (event.name === 'error') hasError = true;
            }
        } catch (err: unknown) {
            hasError = true;
            if (!abortController.signal.aborted) {
                const text = err instanceof Error ? err.message : 'Unknown error';
                session.emit('error', text);
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
            threadUid,
            tenantUid,
            `"${message.slice(0, 100)}" | ${durationMs}ms`,
            hasError ? 'error' : 'success',
        ).catch((error) => this.logger.warn(`Audit log failed: ${error.message}`));
    }

    private async proposalViewsFor(
        messages: AgentThreadMessage[],
        tenantUid: number,
        authorUid: number,
    ): Promise<Map<string, ReturnType<typeof toProposalView>>> {
        const ids = [...new Set(messages.map((row) => row.proposal_id).filter((id): id is string => !!id))];
        if (!ids.length) return new Map();
        const rows = await this.proposals.findAll({
            where: { proposal_id: ids, vpbx_user_uid: tenantUid, user_uid: authorUid },
        });
        return new Map(rows.map((row) => [row.proposal_id, toProposalView(row)]));
    }

    private async workflowViewsFor(
        messages: AgentThreadMessage[],
        tenantUid: number,
        authorUid: number,
        role: number,
        knownProposalIds: Set<string>,
    ): Promise<Map<string, WorkflowPlanView>> {
        const ids = [...new Set(
            messages
                .map((row) => row.proposal_id)
                .filter((id): id is string => !!id && !knownProposalIds.has(id)),
        )];
        const views = new Map<string, WorkflowPlanView>();
        for (const id of ids) {
            try {
                const view = await this.workflows.getOwned(id, {
                    vpbxUserUid: tenantUid,
                    userUid: authorUid,
                    role,
                });
                views.set(id, view);
            } catch (err) {
                if (err instanceof NotFoundException) continue;
                throw err;
            }
        }
        return views;
    }

    private cardsFor(
        messages: AgentThreadMessage[],
        proposalById: Map<string, AgentProposalView>,
        workflowById: Map<string, WorkflowPlanView>,
    ): Record<string, { card: 'single'; proposal: AgentProposalView } | { card: 'workflow'; workflow: WorkflowPlanView }> {
        const cards: Record<
            string,
            { card: 'single'; proposal: AgentProposalView } | { card: 'workflow'; workflow: WorkflowPlanView }
        > = {};
        for (const message of messages) {
            if (message.visibility === 'internal') continue;
            if (message.role === 'system' || message.role === 'user' || message.role === 'assistant') continue;
            if (message.tool_name === 'read_skill') continue;
            const proposalId = message.proposal_id;
            if (!proposalId) continue;
            const itemId = `p${message.uid}`;
            const proposal = proposalById.get(proposalId);
            if (proposal) {
                cards[itemId] = { card: 'single', proposal };
                continue;
            }
            const workflow = workflowById.get(proposalId);
            if (workflow) {
                cards[itemId] = { card: 'workflow', workflow };
            }
        }
        return cards;
    }

    private rejectBodyIdentity(body: Record<string, unknown>): void {
        for (const key of BODY_IDENTITY_KEYS) {
            if (Object.prototype.hasOwnProperty.call(body, key)) {
                throw new BadRequestException('tenant, author and role are taken from the token');
            }
        }
    }

    private resolveLocale(dtoLocale: string | undefined, req: { headers?: Record<string, unknown> }): string {
        if (dtoLocale?.trim()) return dtoLocale.trim();
        const header = req.headers?.['accept-language'];
        if (typeof header === 'string' && header.trim()) {
            return header.split(',')[0]?.trim() || 'ru';
        }
        return 'ru';
    }
}
