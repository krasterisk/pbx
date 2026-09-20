"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var McpToolsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpToolsService = void 0;
const common_1 = require("@nestjs/common");
const user_model_1 = require("../users/user.model");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_adapter_types_1 = require("../ai-platform/ai-adapter.types");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const ai_secret_redaction_1 = require("../ai-platform/ai-secret-redaction");
const pbx_agent_diff_service_1 = require("../ai-chat/pbx-agent-diff.service");
const agent_diff_dto_1 = require("../ai-chat/dto/agent-diff.dto");
const logger_service_1 = require("../logger/logger.service");
const LIVE_OPS_TOOLS = new Set(['cc_force_pause_agent', 'cc_force_unpause_agent']);
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
let McpToolsService = McpToolsService_1 = class McpToolsService {
    aiAdapterRegistry;
    loggerService;
    pbxAgentDiffService;
    logger = new common_1.Logger(McpToolsService_1.name);
    /** Tool registry для прямого JSON-RPC dispatch (без MCP SDK session). uid-независим. */
    toolRegistry = new Map();
    constructor(aiAdapterRegistry, loggerService, pbxAgentDiffService) {
        this.aiAdapterRegistry = aiAdapterRegistry;
        this.loggerService = loggerService;
        this.pbxAgentDiffService = pbxAgentDiffService;
    }
    onApplicationBootstrap() {
        this.registerAll();
    }
    /** Builds/rebuilds the uid-independent tool registry. Idempotent: clears then adopts adapters. */
    registerAll() {
        this.toolRegistry.clear();
        for (const t of this.aiAdapterRegistry.getAllTools()) {
            this.adoptAdapterTool(t);
        }
        this.logger.log(`Registered ${this.toolRegistry.size} MCP tools`);
        const domains = this.readAdapterDomains();
        this.logger.log(`AI adapter domains: ${domains.join(', ') || '(none)'}`);
    }
    getToolsList(_vpbxUserUid) {
        return Array.from(this.toolRegistry.entries()).map(([name, def]) => ({
            name,
            description: def.description,
            inputSchema: def.jsonSchema,
        }));
    }
    isMutationTool(name) {
        return !!this.toolRegistry.get(name)?.mutation;
    }
    async callTool(name, args, vpbxUserUid, ctx) {
        const tool = this.toolRegistry.get(name);
        if (!tool) {
            const available = Array.from(this.toolRegistry.keys()).join(', ');
            throw new Error(`Tool not found: "${name}". Available: ${available}`);
        }
        const cleanArgs = this.sanitizeArgs(name, args, vpbxUserUid);
        try {
            (0, ai_secret_redaction_1.assertNoSecretArgs)(cleanArgs);
        }
        catch (err) {
            return this.plainText(`Ошибка: ${err?.message ?? String(err)}`);
        }
        const proposalCtx = {
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
            }
            catch (err) {
                return this.toolFailure(name, tool, cleanArgs, vpbxUserUid, err);
            }
        }
        if (LIVE_OPS_TOOLS.has(name)) {
            try {
                const result = await tool.handler(cleanArgs, vpbxUserUid);
                this.logToolCall(name, tool, cleanArgs, vpbxUserUid, 'success');
                return this.asTextParts(result);
            }
            catch (err) {
                return this.toolFailure(name, tool, cleanArgs, vpbxUserUid, err);
            }
        }
        if (tool.destructive) {
            return this.plainText(`Операция "${name}" должна быть подтверждена через карточку изменений (proposal endpoint). Вызов из агентного пути отклонён.`);
        }
        try {
            const result = await tool.handler(cleanArgs, vpbxUserUid);
            this.logToolCall(name, tool, cleanArgs, vpbxUserUid, 'success');
            return this.asTextParts(result);
        }
        catch (err) {
            return this.toolFailure(name, tool, cleanArgs, vpbxUserUid, err);
        }
    }
    /**
     * Proposal path for a tool with an executable contract: parse the model
     * arguments, let the adapter build the card and the canonical args, then
     * stamp the payload with the adapter's own schema version and reload policy.
     */
    async dispatchMutation(name, tool, args, ctx) {
        const mutation = tool.mutation;
        try {
            const input = (0, ai_mutation_contract_1.parseMutationInput)(mutation, args);
            const proposed = await mutation.propose(input, {
                vpbxUserUid: ctx.vpbxUserUid,
                userUid: ctx.userUid,
                role: ctx.role,
                isAdmin: ctx.role === user_model_1.UserLevel.ADMIN,
            });
            this.logToolCall(name, tool, args, ctx.vpbxUserUid, 'success');
            if ((0, ai_mutation_contract_1.isToolRefusal)(proposed) || (0, ai_mutation_contract_1.isToolSkip)(proposed)) {
                return this.asTextParts(proposed);
            }
            const view = await this.pbxAgentDiffService.createProposal(this.stampProposal(name, mutation, proposed), ctx);
            return this.plainText(JSON.stringify(view));
        }
        catch (err) {
            return this.toolFailure(name, tool, args, ctx.vpbxUserUid, err);
        }
    }
    /**
     * Canonical args are re-parsed here so a proposal that would fail at confirm
     * time is refused while the user is still looking at the request, and the
     * stored payload is the parsed shape rather than whatever the adapter built.
     */
    stampProposal(name, mutation, proposal) {
        const args = (0, ai_mutation_contract_1.parseMutationArgs)(mutation, proposal.applyPayload?.args ?? {});
        return {
            ...proposal,
            applyPayload: {
                tool: name,
                args: args,
                schemaVersion: mutation.schemaVersion,
            },
            includesDialplanReload: mutation.reload.kind !== 'none',
        };
    }
    /**
     * D-22: copy args entry-by-entry, dropping any model-supplied tenant key.
     * The dispatch uid stays the second positional parameter and is never merged into args.
     */
    sanitizeArgs(name, args, uid) {
        const clean = {};
        for (const [key, value] of Object.entries(args ?? {})) {
            if (ai_adapter_types_1.TENANT_ARG_KEYS.includes(key)) {
                this.logger.warn(`Tool "${name}" tenant=${uid}: stripped model-supplied "${key}"`);
                continue;
            }
            clean[key] = value;
        }
        return clean;
    }
    readAdapterDomains() {
        return [...this.aiAdapterRegistry.getDomains()].sort();
    }
    stripEmoji(text) {
        return text.replace(EMOJI_RE, '').replace(/[ \t]{2,}/g, ' ').trim();
    }
    stripEmojiFromParts(parts) {
        return parts.map((part) => ({ ...part, text: this.stripEmoji(part.text) }));
    }
    plainText(text) {
        return [{ type: 'text', text: this.stripEmoji(text) }];
    }
    asTextParts(result) {
        if (Array.isArray(result)) {
            return this.stripEmojiFromParts(result.map((part) => part && typeof part === 'object' && typeof part.text === 'string'
                ? { ...part, text: this.redactText(part.text) }
                : part));
        }
        const text = typeof result === 'string' ? result : JSON.stringify((0, ai_secret_redaction_1.redactSecrets)(result), null, 2);
        return this.plainText(text);
    }
    redactText(text) {
        try {
            return JSON.stringify((0, ai_secret_redaction_1.redactSecrets)(JSON.parse(text)));
        }
        catch {
            return text;
        }
    }
    async finishProposalResult(result, ctx) {
        if ((0, agent_diff_dto_1.isWorkflowPlanView)(result)) {
            return this.plainText(JSON.stringify(result));
        }
        if ((0, agent_diff_dto_1.isAgentDiffProposal)(result)) {
            const view = await this.pbxAgentDiffService.createProposal(result, ctx);
            return this.plainText(JSON.stringify(view));
        }
        if ((0, agent_diff_dto_1.isProposalClientView)(result)) {
            return this.plainText(JSON.stringify(result));
        }
        return this.asTextParts(result);
    }
    logToolCall(name, tool, args, uid, status) {
        this.loggerService
            .logAction(0, 'ai_tool', tool.entityType, null, uid, this.buildLogDetails(name, args), status)
            .catch(() => { });
    }
    toolFailure(name, tool, args, uid, err) {
        this.logger.error(`Tool "${name}" failed for tenant ${uid}: ${err?.message ?? err}`);
        this.logToolCall(name, tool, args, uid, 'error');
        return this.plainText(`Ошибка: ${err?.message ?? String(err)}`);
    }
    /** Compact, truncated audit message — avoids writing huge entry payloads into action_logs (D-19). */
    buildLogDetails(name, args) {
        let argsStr;
        try {
            argsStr = JSON.stringify(args ?? {});
        }
        catch {
            argsStr = String(args);
        }
        const truncated = argsStr.length > 200 ? `${argsStr.slice(0, 200)}...` : argsStr;
        return `mcp:${name}: ${truncated}`;
    }
    adoptAdapterTool(tool) {
        this.toolRegistry.set(tool.name, {
            description: tool.description,
            jsonSchema: tool.mutation
                ? (0, ai_mutation_contract_1.jsonSchemaOf)(tool.mutation.input)
                : tool.inputSchema?.type === 'object' && tool.inputSchema?.properties
                    ? tool.inputSchema
                    : { type: 'object', properties: tool.inputSchema },
            entityType: tool.entityType,
            destructive: !!tool.destructive,
            proposes: !!tool.proposes,
            mutation: tool.mutation,
            handler: async (args, uid, ctx) => {
                const result = ctx
                    ? await tool.handler(args, uid, ctx)
                    : await tool.handler(args, uid);
                if (tool.proposes &&
                    ((0, agent_diff_dto_1.isAgentDiffProposal)(result) || (0, agent_diff_dto_1.isProposalClientView)(result) || (0, agent_diff_dto_1.isWorkflowPlanView)(result))) {
                    return result;
                }
                const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                return [{ type: 'text', text }];
            },
        });
    }
};
exports.McpToolsService = McpToolsService;
exports.McpToolsService = McpToolsService = McpToolsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_adapter_registry_service_1.AiAdapterRegistryService,
        logger_service_1.LoggerService,
        pbx_agent_diff_service_1.PbxAgentDiffService])
], McpToolsService);
//# sourceMappingURL=mcp-tools.service.js.map