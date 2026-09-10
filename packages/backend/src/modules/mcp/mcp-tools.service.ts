import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { UserLevel } from '../users/user.model';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { TENANT_ARG_KEYS, type AgentDiffProposal, type AiToolDefinition } from '../ai-platform/ai-adapter.types';
import {
    isToolRefusal,
    isToolSkip,
    jsonSchemaOf,
    parseMutationArgs,
    parseMutationInput,
    type AiMutationContract,
} from '../ai-platform/ai-mutation.contract';
import { assertNoSecretArgs, redactSecrets } from '../ai-platform/ai-secret-redaction';
import { PbxAgentDiffService, type ProposalContext } from '../ai-chat/pbx-agent-diff.service';
import { isAgentDiffProposal, isProposalClientView, isWorkflowPlanView } from '../ai-chat/dto/agent-diff.dto';
import { LoggerService } from '../logger/logger.service';

const LIVE_OPS_TOOLS = new Set(['cc_force_pause_agent', 'cc_force_unpause_agent']);

interface McpToolEntry {
    description: string;
    /** Full JSON schema handed to MCP discovery and the OpenAI loop. */
    jsonSchema: Record<string, any>;
    entityType: string;
    /** Destructive tools refuse on the agent path unless proposes or live-ops (D-18) */
    destructive: boolean;
    /** Handler result is persisted as a proposal instead of writing (D-18) */
    proposes: boolean;
    /** Executable mutation contract for proposing tools (schema/propose/revalidate/apply) */
    mutation?: AiMutationContract;
    /** vpbxUserUid is ALWAYS a call parameter — never captured via closure (D-23) */
    handler: (
        args: any,
        vpbxUserUid: number,
        ctx?: { userUid: number; role: number; threadUid: number },
    ) => Promise<any>;
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
 *
 * A tool that carries an executable mutation contract is dispatched through it:
 * arguments are parsed against the same strict schema the model was shown, the
 * adapter builds the card and the canonical server args, and the reload flag is
 * read from the adapter rather than from anything the model sent.
 */
@Injectable()
export class McpToolsService implements OnApplicationBootstrap {
    private readonly logger = new Logger(McpToolsService.name);

    /** Tool registry для прямого JSON-RPC dispatch (без MCP SDK session). uid-независим. */
    private readonly toolRegistry = new Map<string, McpToolEntry>();

    constructor(
        private readonly aiAdapterRegistry: AiAdapterRegistryService,
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
            inputSchema: def.jsonSchema,
        }));
    }

    isMutationTool(name: string): boolean {
        return !!this.toolRegistry.get(name)?.mutation;
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
        try {
            assertNoSecretArgs(cleanArgs);
        } catch (err: any) {
            return this.plainText(`Ошибка: ${err?.message ?? String(err)}`);
        }
        const proposalCtx: ProposalContext = {
            vpbxUserUid,
            userUid: ctx?.userUid ?? 0,
            role: ctx?.role ?? 1,
            threadUid: ctx?.threadUid ?? 0,
        };

        if (tool.mutation) {
            return this.dispatchMutation(name, tool, cleanArgs, proposalCtx);
        }

        if (tool.proposes) {
            try {
                const result = await tool.handler(cleanArgs, vpbxUserUid, {
                    userUid: proposalCtx.userUid,
                    role: proposalCtx.role,
                    threadUid: proposalCtx.threadUid ?? 0,
                });
                this.logToolCall(name, tool, cleanArgs, vpbxUserUid, 'success');
                return await this.finishProposalResult(result, proposalCtx);
            } catch (err: any) {
                return this.toolFailure(name, tool, cleanArgs, vpbxUserUid, err);
            }
        }

        if (LIVE_OPS_TOOLS.has(name)) {
            try {
                const result = await tool.handler(cleanArgs, vpbxUserUid);
                this.logToolCall(name, tool, cleanArgs, vpbxUserUid, 'success');
                return this.asTextParts(result);
            } catch (err: any) {
                return this.toolFailure(name, tool, cleanArgs, vpbxUserUid, err);
            }
        }

        if (tool.destructive) {
            return this.plainText(
                `Операция "${name}" должна быть подтверждена через карточку изменений (proposal endpoint). Вызов из агентного пути отклонён.`,
            );
        }

        try {
            const result = await tool.handler(cleanArgs, vpbxUserUid);
            this.logToolCall(name, tool, cleanArgs, vpbxUserUid, 'success');
            return this.asTextParts(result);
        } catch (err: any) {
            return this.toolFailure(name, tool, cleanArgs, vpbxUserUid, err);
        }
    }

    /**
     * Proposal path for a tool with an executable contract: parse the model
     * arguments, let the adapter build the card and the canonical args, then
     * stamp the payload with the adapter's own schema version and reload policy.
     */
    private async dispatchMutation(
        name: string,
        tool: McpToolEntry,
        args: Record<string, any>,
        ctx: ProposalContext,
    ): Promise<Array<{ type: string; text: string }>> {
        const mutation = tool.mutation!;
        try {
            const input = parseMutationInput(mutation, args);
            const proposed = await mutation.propose(input, {
                vpbxUserUid: ctx.vpbxUserUid,
                userUid: ctx.userUid,
                role: ctx.role,
                isAdmin: ctx.role === UserLevel.ADMIN,
            });
            this.logToolCall(name, tool, args, ctx.vpbxUserUid, 'success');
            if (isToolRefusal(proposed) || isToolSkip(proposed)) {
                return this.asTextParts(proposed);
            }
            const view = await this.pbxAgentDiffService.createProposal(
                this.stampProposal(name, mutation, proposed),
                ctx,
            );
            return this.plainText(JSON.stringify(view));
        } catch (err: any) {
            return this.toolFailure(name, tool, args, ctx.vpbxUserUid, err);
        }
    }

    /**
     * Canonical args are re-parsed here so a proposal that would fail at confirm
     * time is refused while the user is still looking at the request, and the
     * stored payload is the parsed shape rather than whatever the adapter built.
     */
    private stampProposal(
        name: string,
        mutation: AiMutationContract,
        proposal: AgentDiffProposal,
    ): AgentDiffProposal {
        const args = parseMutationArgs(mutation, proposal.applyPayload?.args ?? {});
        return {
            ...proposal,
            applyPayload: {
                tool: name,
                args: args as Record<string, unknown>,
                schemaVersion: mutation.schemaVersion,
            },
            includesDialplanReload: mutation.reload.kind !== 'none',
        };
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
            return this.stripEmojiFromParts(
                result.map((part) =>
                    part && typeof part === 'object' && typeof part.text === 'string'
                        ? { ...part, text: this.redactText(part.text) }
                        : part,
                ),
            );
        }
        const text = typeof result === 'string' ? result : JSON.stringify(redactSecrets(result), null, 2);
        return this.plainText(text);
    }

    private redactText(text: string): string {
        try {
            return JSON.stringify(redactSecrets(JSON.parse(text)));
        } catch {
            return text;
        }
    }

    private async finishProposalResult(
        result: unknown,
        ctx: ProposalContext,
    ): Promise<Array<{ type: string; text: string }>> {
        if (isWorkflowPlanView(result)) {
            return this.plainText(JSON.stringify(result));
        }
        if (isAgentDiffProposal(result)) {
            const view = await this.pbxAgentDiffService.createProposal(result, ctx);
            return this.plainText(JSON.stringify(view));
        }
        if (isProposalClientView(result)) {
            return this.plainText(JSON.stringify(result));
        }
        return this.asTextParts(result);
    }

    private logToolCall(
        name: string,
        tool: McpToolEntry,
        args: Record<string, any>,
        uid: number,
        status: 'success' | 'error',
    ): void {
        this.loggerService
            .logAction(0, 'ai_tool', tool.entityType, null, uid, this.buildLogDetails(name, args), status)
            .catch(() => {});
    }

    private toolFailure(
        name: string,
        tool: McpToolEntry,
        args: Record<string, any>,
        uid: number,
        err: any,
    ): Array<{ type: string; text: string }> {
        this.logger.error(`Tool "${name}" failed for tenant ${uid}: ${err?.message ?? err}`);
        this.logToolCall(name, tool, args, uid, 'error');
        return this.plainText(`Ошибка: ${err?.message ?? String(err)}`);
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
            jsonSchema: tool.mutation
                ? jsonSchemaOf(tool.mutation.input)
                : { type: 'object', properties: tool.inputSchema },
            entityType: tool.entityType,
            destructive: !!tool.destructive,
            proposes: !!tool.proposes,
            mutation: tool.mutation,
            handler: async (args, uid, ctx) => {
                const result = ctx
                    ? await tool.handler(args, uid, ctx)
                    : await tool.handler(args, uid);
                if (
                    tool.proposes &&
                    (isAgentDiffProposal(result) || isProposalClientView(result) || isWorkflowPlanView(result))
                ) {
                    return result;
                }
                const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                return [{ type: 'text', text }];
            },
        });
    }
}
