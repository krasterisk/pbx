import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EndpointsService } from '../endpoints/endpoints.service';
import { TrunksService } from '../trunks/trunks.service';
import { IvrsService } from '../ivrs/ivrs.service';
import { QueuesService } from '../queues/queues.service';
import { RoutesService } from '../routes/routes.service';
import { ContextIncludesService } from '../routes/context-includes.service';
import { ContextsService } from '../contexts/contexts.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { PbxContextBuilderService } from '../ai-chat/pbx-context-builder.service';
import { InjectModel } from '@nestjs/sequelize';
import { Context } from '../contexts/context.model';
import { CdrService } from '../reports/cdr/cdr.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { TENANT_ARG_KEYS, type AiToolDefinition } from '../ai-platform/ai-adapter.types';
import { AiChatSettingsService } from '../ai-chat/ai-chat-settings.service';
import { PbxAgentDiffService, type ProposalContext } from '../ai-chat/pbx-agent-diff.service';
import { isAgentDiffProposal, isProposalClientView } from '../ai-chat/dto/agent-diff.dto';
import { LoggerService } from '../logger/logger.service';

const LIVE_OPS_TOOLS = new Set(['cc_force_pause_agent', 'cc_force_unpause_agent']);

interface McpToolEntry {
    description: string;
    inputSchema: Record<string, any>;
    entityType: string;
    /** Destructive tools refuse on the agent path unless proposes or live-ops (D-18) */
    destructive: boolean;
    /** Handler result is persisted as a proposal instead of writing (D-18) */
    proposes: boolean;
    /** vpbxUserUid is ALWAYS a call parameter — never captured via closure (D-23) */
    handler: (args: any, vpbxUserUid: number) => Promise<any>;
}

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

/**
 * McpToolsService — single hardened dispatch for adapter-registered tools.
 *
 * Tools come only from AiAdapterRegistryService (D-27). This class does not
 * register tools of its own. New modules ship an adapter beside them (D-16).
 *
 * McpSessionService calls callTool() and getToolsList() directly.
 *
 * Handler signature is (args, vpbxUserUid): uid is always a call parameter,
 * never a registration-time closure (D-23).
 */
@Injectable()
export class McpToolsService implements OnApplicationBootstrap {
    private readonly logger = new Logger(McpToolsService.name);

    /** Tool registry для прямого JSON-RPC dispatch (без MCP SDK session). uid-независим. */
    private readonly toolRegistry = new Map<string, McpToolEntry>();

    constructor(
        _endpointsService: EndpointsService,
        _trunksService: TrunksService,
        _ivrsService: IvrsService,
        _queuesService: QueuesService,
        _routesService: RoutesService,
        _contextIncludesService: ContextIncludesService,
        _contextsService: ContextsService,
        _dialplanApplyService: DialplanApplyService,
        _contextBuilder: PbxContextBuilderService,
        @InjectModel(Context) _contextModel: typeof Context,
        _cdrService: CdrService,
        private readonly aiAdapterRegistry: AiAdapterRegistryService,
        _aiChatSettingsService: AiChatSettingsService,
        private readonly loggerService: LoggerService,
        private readonly pbxAgentDiffService: PbxAgentDiffService,
    ) {}

    onApplicationBootstrap(): void {
        this.registerAll();
    }

    /** Builds/rebuilds the uid-independent tool registry. Idempotent: clears then adopts adapters. */
    registerAll(): void {
        this.toolRegistry.clear();

        for (const t of this.aiAdapterRegistry.getAllTools()) {
            this.adoptAdapterTool(t);
        }

        this.logger.log(`Registered ${this.toolRegistry.size} MCP tools`);
        const domains = this.readAdapterDomains();
        this.logger.log(`AI adapter domains: ${domains.join(', ') || '(none)'}`);
    }

    getToolsList(_vpbxUserUid: number): Array<{ name: string; description: string; inputSchema: any }> {
        return Array.from(this.toolRegistry.entries()).map(([name, def]) => ({
            name,
            description: def.description,
            inputSchema: { type: 'object', properties: def.inputSchema },
        }));
    }

    async callTool(
        name: string,
        args: Record<string, any>,
        vpbxUserUid: number,
        ctx?: Partial<ProposalContext>,
    ): Promise<Array<{ type: string; text: string }>> {
        const tool = this.toolRegistry.get(name);
        if (!tool) {
            const available = Array.from(this.toolRegistry.keys()).join(', ');
            throw new Error(`Tool not found: "${name}". Available: ${available}`);
        }

        const cleanArgs = this.sanitizeArgs(name, args, vpbxUserUid);
        const proposalCtx: ProposalContext = {
            vpbxUserUid,
            userUid: ctx?.userUid ?? 0,
            role: ctx?.role ?? 1,
            threadUid: ctx?.threadUid ?? 0,
        };

        if (tool.proposes) {
            try {
                const result = await tool.handler(cleanArgs, vpbxUserUid);
                this.loggerService.logAction(0, 'ai_tool', tool.entityType, null, vpbxUserUid, this.buildLogDetails(name, cleanArgs), 'success').catch(() => {});
                return await this.finishProposalResult(result, proposalCtx);
            } catch (err: any) {
                this.logger.error(`Tool "${name}" failed for tenant ${vpbxUserUid}: ${err.message}`);
                this.loggerService.logAction(0, 'ai_tool', tool.entityType, null, vpbxUserUid, this.buildLogDetails(name, cleanArgs), 'error').catch(() => {});
                return this.plainText(`Ошибка: ${err.message}`);
            }
        }

        if (LIVE_OPS_TOOLS.has(name)) {
            try {
                const result = await tool.handler(cleanArgs, vpbxUserUid);
                this.loggerService.logAction(0, 'ai_tool', tool.entityType, null, vpbxUserUid, this.buildLogDetails(name, cleanArgs), 'success').catch(() => {});
                return this.asTextParts(result);
            } catch (err: any) {
                this.logger.error(`Tool "${name}" failed for tenant ${vpbxUserUid}: ${err.message}`);
                this.loggerService.logAction(0, 'ai_tool', tool.entityType, null, vpbxUserUid, this.buildLogDetails(name, cleanArgs), 'error').catch(() => {});
                return this.plainText(`Ошибка: ${err.message}`);
            }
        }

        if (tool.destructive) {
            return this.plainText(
                `Операция "${name}" должна быть подтверждена через карточку изменений (proposal endpoint). Вызов из агентного пути отклонён.`,
            );
        }

        try {
            const result = await tool.handler(cleanArgs, vpbxUserUid);
            this.loggerService.logAction(0, 'ai_tool', tool.entityType, null, vpbxUserUid, this.buildLogDetails(name, cleanArgs), 'success').catch(() => {});
            return this.asTextParts(result);
        } catch (err: any) {
            this.logger.error(`Tool "${name}" failed for tenant ${vpbxUserUid}: ${err.message}`);
            this.loggerService.logAction(0, 'ai_tool', tool.entityType, null, vpbxUserUid, this.buildLogDetails(name, cleanArgs), 'error').catch(() => {});
            return this.plainText(`Ошибка: ${err.message}`);
        }
    }

    /**
     * D-22: copy args entry-by-entry, dropping any model-supplied tenant key.
     * The dispatch uid stays the second positional parameter and is never merged into args.
     */
    private sanitizeArgs(name: string, args: Record<string, any>, uid: number): Record<string, any> {
        const clean: Record<string, any> = {};
        for (const [key, value] of Object.entries(args ?? {})) {
            if ((TENANT_ARG_KEYS as readonly string[]).includes(key)) {
                this.logger.warn(`Tool "${name}" tenant=${uid}: stripped model-supplied "${key}"`);
                continue;
            }
            clean[key] = value;
        }
        return clean;
    }

    private readAdapterDomains(): string[] {
        return [...this.aiAdapterRegistry.getDomains()].sort();
    }

    private stripEmoji(text: string): string {
        return text.replace(EMOJI_RE, '').replace(/[ \t]{2,}/g, ' ').trim();
    }

    private stripEmojiFromParts(parts: Array<{ type: string; text: string }>): Array<{ type: string; text: string }> {
        return parts.map((part) => ({ ...part, text: this.stripEmoji(part.text) }));
    }

    private plainText(text: string): Array<{ type: string; text: string }> {
        return [{ type: 'text', text: this.stripEmoji(text) }];
    }

    private asTextParts(result: any): Array<{ type: string; text: string }> {
        if (Array.isArray(result)) {
            return this.stripEmojiFromParts(result);
        }
        const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        return this.plainText(text);
    }

    private async finishProposalResult(
        result: unknown,
        ctx: ProposalContext,
    ): Promise<Array<{ type: string; text: string }>> {
        if (isAgentDiffProposal(result)) {
            const view = await this.pbxAgentDiffService.createProposal(result, ctx);
            return this.plainText(JSON.stringify(view));
        }
        if (isProposalClientView(result)) {
            return this.plainText(JSON.stringify(result));
        }
        return this.asTextParts(result);
    }

    /** Compact, truncated audit message — avoids writing huge entry payloads into action_logs (D-19). */
    private buildLogDetails(name: string, args: Record<string, any>): string {
        let argsStr: string;
        try {
            argsStr = JSON.stringify(args ?? {});
        } catch {
            argsStr = String(args);
        }
        const truncated = argsStr.length > 200 ? `${argsStr.slice(0, 200)}...` : argsStr;
        return `mcp:${name}: ${truncated}`;
    }

    private adoptAdapterTool(tool: AiToolDefinition): void {
        this.toolRegistry.set(tool.name, {
            description: tool.description,
            inputSchema: tool.inputSchema,
            entityType: tool.entityType,
            destructive: !!tool.destructive,
            proposes: !!tool.proposes,
            handler: async (args, uid) => {
                const result = await tool.handler(args, uid);
                if (tool.proposes && (isAgentDiffProposal(result) || isProposalClientView(result))) {
                    return result;
                }
                const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                return [{ type: 'text', text }];
            },
        });
    }
}
