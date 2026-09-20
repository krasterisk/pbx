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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PbxAgentLoopService = exports.CONTINUE_AFTER_APPLY_PROMPT = exports.PROMPT_TOTAL_BUDGET_CHARS = exports.ASSISTANT_OUTPUT_BUDGET_CHARS = exports.TOOL_RESULT_MAX_CHARS = exports.DEFAULT_TOOL_ARG_RETRIES = exports.DEFAULT_MAX_AGENT_STEPS = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shared_1 = require("@krasterisk/shared");
const prompt_injection_util_1 = require("../../shared/utils/prompt-injection.util");
const ai_providers_service_1 = require("../ai-connectivity/ai-providers.service");
const mcp_tools_service_1 = require("../mcp/mcp-tools.service");
const pbx_agent_llm_client_1 = require("./pbx-agent-llm.client");
const pbx_context_builder_service_1 = require("./pbx-context-builder.service");
const pbx_agent_thread_service_1 = require("./pbx-agent-thread.service");
const pbx_conversation_brief_service_1 = require("./pbx-conversation-brief.service");
const agent_intent_classifier_service_1 = require("./agent-intent-classifier.service");
const agent_skill_registry_service_1 = require("../ai-platform/agent-skill-registry.service");
const conversation_brief_types_1 = require("./conversation-brief.types");
const ai_chat_settings_service_1 = require("./ai-chat-settings.service");
const agent_timeline_util_1 = require("./agent-timeline.util");
const turn_outcome_util_1 = require("./turn-outcome.util");
const agent_diff_dto_1 = require("./dto/agent-diff.dto");
const pbx_workflow_runner_service_1 = require("./pbx-workflow-runner.service");
const ivr_setup_draft_1 = require("./ivr-setup-draft");
exports.DEFAULT_MAX_AGENT_STEPS = 12;
exports.DEFAULT_TOOL_ARG_RETRIES = 1;
exports.TOOL_RESULT_MAX_CHARS = 4000;
exports.ASSISTANT_OUTPUT_BUDGET_CHARS = 8000;
const PLAN_CHECKLIST_TOOLS = new Set([
    'list_tts_engines',
    'list_endpoints',
    'list_call_groups',
    'list_ivrs',
    'list_dialplan_apps',
]);
const READ_TOOL_NAME = /^(?:get_|list_|read_|find_|describe_|evaluate_|cc_get_|dialplan_dry_run$)/;
exports.PROMPT_TOTAL_BUDGET_CHARS = 48_000;
exports.CONTINUE_AFTER_APPLY_PROMPT = 'Карточка уже применена. Не создавай те же абонентов, группу или меню снова. ' +
    'Одним-двумя предложениями скажи, что готово: публичные имена и номера. ' +
    'Не называй инструменты. Не предлагай «проверить через» что-либо. Таймаут называй таймаутом, не «цифра t».';
let PbxAgentLoopService = class PbxAgentLoopService {
    llm;
    providers;
    contextBuilder;
    threads;
    mcpTools;
    config;
    chatSettings;
    briefService;
    intentClassifier;
    skillRegistry;
    workflows;
    constructor(llm, providers, contextBuilder, threads, mcpTools, config, chatSettings, briefService, intentClassifier, skillRegistry, workflows) {
        this.llm = llm;
        this.providers = providers;
        this.contextBuilder = contextBuilder;
        this.threads = threads;
        this.mcpTools = mcpTools;
        this.config = config;
        this.chatSettings = chatSettings;
        this.briefService = briefService;
        this.intentClassifier = intentClassifier;
        this.skillRegistry = skillRegistry;
        this.workflows = workflows;
    }
    /**
     * One user message → in-process model/tool cycle (D-06).
     * Persist as you go so a dropped connection still leaves a readable thread (D-26).
     */
    async *runTurn(message, conversation, ctx) {
        const threadUid = conversation.uid;
        const { tenantUid, authorUid, role } = ctx;
        const readOnlyRequest = /не меняй|не изменяй|ничего не менять|только диагностик|без изменений|read.only/i.test(message);
        const maxSteps = this.readInt('CC_AI_MAX_AGENT_STEPS', exports.DEFAULT_MAX_AGENT_STEPS);
        const argRetries = this.readInt('CC_AI_TOOL_ARG_RETRIES', exports.DEFAULT_TOOL_ARG_RETRIES);
        const argFailures = new Map();
        const userVisibility = ctx.userVisibility ?? 'public';
        const userRow = await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
            role: 'user',
            content: message,
            visibility: userVisibility,
        });
        yield { name: 'thread', data: { uid: threadUid } };
        if (userVisibility !== 'internal') {
            yield {
                name: 'item',
                data: {
                    kind: 'user',
                    id: `m${userRow.uid}`,
                    text: message,
                    createdAt: this.createdAtIso(userRow.created_at),
                },
            };
        }
        const preferredUid = await this.chatSettings.getDefaultProviderUid(tenantUid);
        const provider = await this.providers.findDefaultLlm(tenantUid, preferredUid);
        if (!provider) {
            yield { name: 'error', data: { code: 'missing_llm', message: 'No language-model provider is configured' } };
            return;
        }
        await this.threads.setProviderUid(threadUid, tenantUid, authorUid, provider.uid);
        const thread = await this.threads.getThread(threadUid, tenantUid, authorUid);
        const brief = this.briefService.compile(thread.brief_json, userRow.uid, message);
        await this.threads.saveBrief(threadUid, tenantUid, authorUid, brief);
        const classification = this.intentClassifier.classify({ message, brief });
        const selectedSkillBodies = this.skillRegistry.readSkillsForPrompt(classification.skillNames);
        const state = await this.contextBuilder.buildState(tenantUid);
        const systemPrompt = this.contextBuilder.buildSystemPrompt(state, {
            briefText: (0, conversation_brief_types_1.renderBriefForPrompt)(brief),
            locale: ctx.locale,
            selectedSkillBodies,
        });
        const history = await this.threads.listMessagesForReplay(threadUid, tenantUid, authorUid);
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history
                .filter((row) => row.role !== 'system')
                .map((row) => this.toLoopMessage(row)),
        ];
        this.enforcePromptBudget(messages);
        const allTools = this.mcpTools.getToolsList(tenantUid);
        const allowedNames = new Set(this.intentClassifier.filterToolNames(allTools.map((tool) => tool.name), classification));
        const registered = this.registerTools(allTools.filter((tool) => allowedNames.has(tool.name)
            && (!readOnlyRequest || READ_TOOL_NAME.test(tool.name))));
        const tools = registered.map((tool) => tool.spec);
        let steps = 0;
        let incompleteContinues = 0;
        let forceToolChoice = /(?:создай|создать|настрой|проверь|диагност|create |configure |diagnose )/i.test(message);
        let calledToolThisTurn = false;
        let checklistReads = 0;
        let proposePlanAttempts = 0;
        let providerTimeoutRetries = 0;
        let hadProposal = false;
        let mutationsThisTurn = 0;
        let lastAssistant = '';
        const providerModel = typeof provider.defaults?.model === 'string'
            ? String(provider.defaults.model)
            : provider.name;
        const proposalCtx = {
            vpbxUserUid: tenantUid,
            userUid: authorUid,
            role,
            threadUid,
        };
        const pendingWorkflow = await this.workflows.findLatestPendingForThread(threadUid, proposalCtx);
        if ((0, shared_1.looksLikeUserConfirm)(message) && pendingWorkflow) {
            try {
                const applied = await this.workflows.apply(pendingWorkflow.workflowId, proposalCtx);
                const closing = applied.status === 'applied'
                    ? 'План применён. Сущности из карточки созданы.'
                    : applied.error
                        ? `Не удалось применить план: ${(0, shared_1.scrubToolIdsFromPublicText)(applied.error)}`
                        : 'Карточка не применена.';
                const closeKind = applied.status === 'applied' ? 'complete' : 'question';
                const row = await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                    role: 'assistant',
                    content: closing,
                    close_kind: closeKind,
                    visibility: 'public',
                });
                yield {
                    name: 'item',
                    data: {
                        kind: 'assistant',
                        id: `m${row.uid}`,
                        text: closing,
                        closeKind,
                        createdAt: this.createdAtIso(row.created_at),
                    },
                };
                yield { name: 'done', data: { closeKind } };
                return;
            }
            catch (err) {
                const reason = err instanceof Error ? err.message : String(err);
                messages.push({
                    role: 'system',
                    content: `Пользователь подтвердил, но применить карточку не удалось (${reason}). Обнови план через propose_plan или скажи, что сломалось.`,
                });
                forceToolChoice = true;
            }
        }
        else if ((0, shared_1.looksLikeUserConfirm)(message)) {
            messages.push({
                role: 'system',
                content: 'Пользователь подтвердил. Не вызывай create_call_group снова и не передавай поля одного члена (member_type/value) как аргументы группы. ' +
                    'Если группа таймаута уже есть (например exten 9010), сразу вызови create_ivr с подтверждёнными name/prompts/menu_items (t → kind group, target 9010). ' +
                    'Карточку в UI подтверждает пользователь — не придумывай apply tool.',
            });
            forceToolChoice = true;
        }
        else {
            const compiled = yield* this.tryServerIvrPlan({
                message,
                threadUid,
                tenantUid,
                authorUid,
                role,
                locale: ctx.locale,
                providerModel,
            });
            if (compiled)
                return;
            if (pendingWorkflow) {
                messages.push({
                    role: 'system',
                    content: 'На треде уже есть незакрытая карточка. Короткое уточнение (номер группы, абонент, цифра, таймаут) — не новый бриф: вызови propose_plan с полным актуальным чеклистом, применив правку к последнему плану. Новая карточка заменит старую. Не проси подтвердить устаревший план.',
                });
                forceToolChoice = true;
            }
        }
        // Clear multi-domain configure briefs should start by calling tools, not narrating.
        const preferTools = classification.confidence >= 0.5 &&
            classification.skillNames.some((name) => ['ivrs', 'endpoints', 'call-groups', 'queues', 'routes', 'trunks', 'pbx-setup'].includes(name));
        while (true) {
            if (ctx.signal?.aborted) {
                yield this.cancelled();
                return;
            }
            if (steps >= maxSteps) {
                const status = (0, turn_outcome_util_1.forcedTurnStatus)({ locale: ctx.locale, hadProposal, lastAssistant });
                await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                    role: 'assistant',
                    content: status,
                    visibility: 'internal',
                });
                yield {
                    name: 'error',
                    data: { code: 'max_steps_exceeded', message: 'Step ceiling reached', maxSteps },
                };
                return;
            }
            steps += 1;
            const requireTools = tools.length > 0 &&
                (forceToolChoice || (preferTools && !calledToolThisTurn && !hadProposal));
            const completion = await this.llm.chat({
                provider: {
                    uid: provider.uid,
                    tenantUid: provider.user_uid,
                    name: provider.name,
                    endpoint: provider.endpoint,
                    auth_type: provider.auth_type,
                    capabilities: provider.capabilities,
                    defaults: provider.defaults,
                    vendor: provider.vendor,
                },
                messages: messages,
                tools,
                toolChoice: requireTools ? 'required' : 'auto',
                signal: ctx.signal,
                stream: true,
            });
            if (completion.usage) {
                await this.threads.addUsage(threadUid, tenantUid, authorUid, {
                    in: completion.usage.promptTokens,
                    out: completion.usage.completionTokens,
                });
            }
            if (ctx.signal?.aborted || completion.error?.code === 'aborted') {
                yield this.cancelled();
                return;
            }
            if (completion.error) {
                if (completion.error.code === 'provider_timeout'
                    && calledToolThisTurn
                    && !hadProposal
                    && providerTimeoutRetries < 1) {
                    providerTimeoutRetries += 1;
                    messages.push({
                        role: 'system',
                        content: this.proposePlanNowReminder(ctx.locale, message),
                    });
                    forceToolChoice = true;
                    continue;
                }
                yield { name: 'error', data: completion.error };
                return;
            }
            const text = completion.text ?? '';
            const toolCalls = [...(completion.toolCalls ?? [])];
            if (toolCalls.length) {
                calledToolThisTurn = true;
                if (toolCalls.some((call) => PLAN_CHECKLIST_TOOLS.has(call.name))) {
                    checklistReads += toolCalls.filter((call) => PLAN_CHECKLIST_TOOLS.has(call.name)).length;
                }
                forceToolChoice = false;
                if (completion.text) {
                    lastAssistant = completion.text;
                }
                await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                    role: 'assistant',
                    content: completion.text || null,
                    tool_calls: toolCalls,
                    provider_model: providerModel,
                    visibility: 'internal',
                    reasoning: completion.reasoning ?? null,
                });
                messages.push(this.assistantToolMessage(completion.text, toolCalls));
                const answeredToolCallIds = new Set();
                for (const [callIndex, call] of toolCalls.entries()) {
                    if (ctx.signal?.aborted) {
                        await this.closeUnansweredToolCalls({
                            toolCalls,
                            answeredToolCallIds,
                            messages,
                            threadUid,
                            tenantUid,
                            authorUid,
                            providerModel,
                            reason: 'cancelled',
                        });
                        yield this.cancelled();
                        return;
                    }
                    const stepId = `s${threadUid}_${steps}_${callIndex}`;
                    yield { name: 'item', data: this.stepItem(call.name, stepId, false) };
                    const normalizedCall = this.normalizeToolCallArgs(call);
                    if (readOnlyRequest && !READ_TOOL_NAME.test(normalizedCall.name)) {
                        await this.closeUnansweredToolCalls({ toolCalls, answeredToolCallIds, messages,
                            threadUid, tenantUid, authorUid, providerModel, reason: 'read_only_request' });
                        yield { name: 'error', data: { code: 'read_only_request', message: 'Запрошена диагностика без изменений. Изменение не выполнено.' } };
                        return;
                    }
                    if (normalizedCall.name === 'propose_plan') {
                        proposePlanAttempts += 1;
                        const shapeHint = this.proposePlanShapeHint(normalizedCall.arguments ?? {});
                        if (shapeHint) {
                            const errorText = JSON.stringify({
                                error: 'invalid_arguments',
                                tool: 'propose_plan',
                                received: Object.keys(normalizedCall.arguments ?? {}),
                                hint: shapeHint,
                            });
                            yield { name: 'item', data: this.stepItem(normalizedCall.name, stepId, true, (0, agent_timeline_util_1.humanStepDetail)(normalizedCall.name, errorText)) };
                            await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                                role: 'tool',
                                content: errorText,
                                tool_name: normalizedCall.name,
                                tool_call_id: normalizedCall.id,
                                provider_model: providerModel,
                                visibility: 'internal',
                            });
                            messages.push({
                                role: 'tool',
                                content: this.toModelToolContent(normalizedCall.name, errorText),
                                tool_call_id: normalizedCall.id,
                                name: normalizedCall.name,
                            });
                            answeredToolCallIds.add(normalizedCall.id);
                            if (proposePlanAttempts < 2) {
                                messages.push({ role: 'system', content: this.proposePlanNowReminder(ctx.locale, message) });
                                forceToolChoice = true;
                            }
                            continue;
                        }
                    }
                    if (this.mcpTools.isMutationTool(normalizedCall.name)) {
                        const batchFirst = (0, turn_outcome_util_1.looksLikeMultiEntitySetup)(message);
                        mutationsThisTurn += 1;
                        if (batchFirst || mutationsThisTurn >= 2) {
                            const refusal = JSON.stringify({
                                error: 'batch_required',
                                tool: normalizedCall.name,
                                hint: batchFirst
                                    ? 'Этот запрос меняет несколько сущностей. Не вызывай create_* по отдельности. '
                                        + 'Собери всё в один propose_plan (title + steps[]): абоненты, группа таймаута, меню. '
                                        + 'Шаги ссылаются друг на друга через steps.<id>.result.<поле>.'
                                    : 'Вторая мутация за ход запрещена. Собери оставшиеся изменения в один propose_plan '
                                        + '(шаги ссылаются друг на друга через steps.<id>.result.<поле>) и вызови его вместо серии create_*.',
                            });
                            // tool-строка обязательна: OpenAI требует ответ на каждый tool_call_id
                            yield { name: 'item', data: this.stepItem(normalizedCall.name, stepId, true, (0, agent_timeline_util_1.humanStepDetail)(normalizedCall.name, refusal)) };
                            await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                                role: 'tool', content: refusal, tool_name: normalizedCall.name,
                                tool_call_id: normalizedCall.id, provider_model: providerModel, visibility: 'internal',
                            });
                            messages.push({ role: 'tool', content: this.toModelToolContent(normalizedCall.name, refusal), tool_call_id: normalizedCall.id, name: normalizedCall.name });
                            answeredToolCallIds.add(normalizedCall.id);
                            forceToolChoice = true;
                            continue;
                        }
                    }
                    const invalidFields = this.invalidArgFields(normalizedCall, registered);
                    if (invalidFields.length) {
                        const failures = (argFailures.get(normalizedCall.name) ?? 0) + 1;
                        argFailures.set(normalizedCall.name, failures);
                        const errorText = JSON.stringify({
                            error: 'invalid_arguments',
                            fields: invalidFields,
                            tool: normalizedCall.name,
                            received: Object.keys(normalizedCall.arguments ?? {}),
                            hint: this.missingArgsHint(normalizedCall.name, invalidFields),
                        });
                        yield { name: 'item', data: this.stepItem(normalizedCall.name, stepId, true, (0, agent_timeline_util_1.humanStepDetail)(normalizedCall.name, errorText)) };
                        await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                            role: 'tool',
                            content: errorText,
                            tool_name: normalizedCall.name,
                            tool_call_id: normalizedCall.id,
                            provider_model: providerModel,
                        });
                        messages.push({
                            role: 'tool',
                            content: this.toModelToolContent(normalizedCall.name, errorText),
                            tool_call_id: normalizedCall.id,
                            name: normalizedCall.name,
                        });
                        answeredToolCallIds.add(normalizedCall.id);
                        if (failures > argRetries) {
                            await this.closeUnansweredToolCalls({
                                toolCalls,
                                answeredToolCallIds,
                                messages,
                                threadUid,
                                tenantUid,
                                authorUid,
                                providerModel,
                                reason: 'tool_arg_retries_exceeded',
                            });
                            // Soft-continue: gpt-5-nano often retries create_* with a nested fragment.
                            if (normalizedCall.name === 'create_call_group' || normalizedCall.name === 'create_ivr') {
                                messages.push({
                                    role: 'system',
                                    content: this.fragmentRetryHint(normalizedCall.name),
                                });
                                forceToolChoice = true;
                                break;
                            }
                            yield {
                                name: 'error',
                                data: {
                                    code: 'tool_arg_retries_exceeded',
                                    message: `Invalid arguments for ${normalizedCall.name}`,
                                    fields: invalidFields,
                                    tool: normalizedCall.name,
                                },
                            };
                            return;
                        }
                        continue;
                    }
                    let resultText;
                    try {
                        const parts = await this.mcpTools.callTool(normalizedCall.name, normalizedCall.arguments, tenantUid, {
                            userUid: authorUid,
                            role,
                            threadUid,
                        });
                        resultText = parts.map((part) => part.text).join('\n');
                    }
                    catch (err) {
                        resultText = JSON.stringify({
                            error: 'tool_failed',
                            tool: normalizedCall.name,
                            message: err instanceof Error ? err.message : String(err),
                        });
                    }
                    const proposal = this.asProposalView(resultText);
                    resultText = this.truncateToolResult(resultText);
                    yield { name: 'item', data: this.stepItem(normalizedCall.name, stepId, true, (0, agent_timeline_util_1.humanStepDetail)(normalizedCall.name, resultText)) };
                    const persisted = proposal
                        ? this.pendingProposalForModel(normalizedCall.name, proposal)
                        : resultText;
                    const toolRow = await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                        role: 'tool',
                        content: persisted,
                        tool_name: normalizedCall.name,
                        tool_call_id: normalizedCall.id,
                        proposal_id: proposal?.id ?? null,
                        provider_model: providerModel,
                    });
                    if (proposal) {
                        hadProposal = true;
                        yield {
                            name: 'item',
                            data: {
                                kind: 'proposal',
                                id: `p${toolRow.uid}`,
                                card: proposal.card,
                                createdAt: this.createdAtIso(toolRow.created_at),
                            },
                        };
                    }
                    else if (normalizedCall.name === 'propose_plan' && (0, agent_timeline_util_1.isToolErrorContent)(resultText)) {
                        if (proposePlanAttempts < 2) {
                            const hint = this.proposePlanCompileHint(resultText, message);
                            if (hint)
                                messages.push({ role: 'system', content: hint });
                            forceToolChoice = true;
                        }
                    }
                    messages.push({
                        role: 'tool',
                        content: this.toModelToolContent(normalizedCall.name, proposal ? persisted : resultText),
                        tool_call_id: normalizedCall.id,
                        name: normalizedCall.name,
                    });
                    answeredToolCallIds.add(normalizedCall.id);
                }
                if (hadProposal && !forceToolChoice) {
                    yield* this.closeAfterProposal({
                        threadUid,
                        tenantUid,
                        authorUid,
                        locale: ctx.locale,
                        providerModel,
                    });
                    return;
                }
                if (!readOnlyRequest && !hadProposal && checklistReads >= 2 && !(0, turn_outcome_util_1.looksLikeRouteSetup)(message)) {
                    const compiled = yield* this.tryServerIvrPlan({
                        message,
                        threadUid,
                        tenantUid,
                        authorUid,
                        role,
                        locale: ctx.locale,
                        providerModel,
                    });
                    if (compiled)
                        return;
                }
                if (!hadProposal && proposePlanAttempts >= 2) {
                    const status = (0, turn_outcome_util_1.forcedTurnStatus)({ locale: ctx.locale, hadProposal, lastAssistant });
                    await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                        role: 'assistant',
                        content: status,
                        visibility: 'internal',
                    });
                    yield { name: 'done', data: { closeKind: 'complete' } };
                    return;
                }
                if (!readOnlyRequest && !hadProposal && checklistReads >= 2 && proposePlanAttempts < 2) {
                    messages.push({
                        role: 'system',
                        content: this.proposePlanNowReminder(ctx.locale, message),
                    });
                    forceToolChoice = true;
                }
                continue;
            }
            const close = (0, turn_outcome_util_1.classifyTurnClose)(text, {
                hadProposal,
                truncated: completion.finishReason === 'length' || (0, turn_outcome_util_1.looksTruncated)(text),
            });
            if (close === 'incomplete') {
                incompleteContinues += 1;
                lastAssistant = text || lastAssistant;
                if (text) {
                    await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                        role: 'assistant',
                        content: text,
                        visibility: 'internal',
                        reasoning: completion.reasoning ?? null,
                    });
                }
                const emptyNoTools = !text.trim();
                if ((emptyNoTools || /подтверд|confirm/i.test(text)) && tools.length) {
                    forceToolChoice = true;
                }
                const maxIncomplete = forceToolChoice ? 3 : 2;
                if (incompleteContinues <= maxIncomplete) {
                    messages.push({
                        role: 'system',
                        content: (0, turn_outcome_util_1.incompleteReminder)(ctx.locale, classification.skillNames),
                    });
                    continue;
                }
                const status = (0, turn_outcome_util_1.forcedTurnStatus)({ locale: ctx.locale, hadProposal, lastAssistant });
                await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                    role: 'assistant',
                    content: status,
                    visibility: 'internal',
                });
                yield { name: 'done', data: { closeKind: 'complete' } };
                return;
            }
            if (close === 'wait_confirm' && pendingWorkflow && !hadProposal) {
                incompleteContinues += 1;
                lastAssistant = text || lastAssistant;
                if (text) {
                    await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                        role: 'assistant',
                        content: text,
                        visibility: 'internal',
                        reasoning: completion.reasoning ?? null,
                    });
                }
                if (incompleteContinues <= 2) {
                    messages.push({
                        role: 'system',
                        content: 'Нельзя просить подтвердить старую карточку. Вызови propose_plan с актуальными шагами — она заменит прежнюю.',
                    });
                    forceToolChoice = true;
                    continue;
                }
            }
            forceToolChoice = false;
            const closeKind = close;
            const closing = (0, shared_1.scrubToolIdsFromPublicText)(text || (0, turn_outcome_util_1.forcedTurnStatus)({ locale: ctx.locale, hadProposal, lastAssistant }));
            await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
                role: 'assistant',
                content: closing,
                close_kind: closeKind,
                visibility: 'public',
                reasoning: completion.reasoning ?? null,
                provider_model: providerModel,
            });
            yield {
                name: 'item',
                data: {
                    kind: 'assistant',
                    id: `a${threadUid}_${steps}`,
                    text: closing,
                    closeKind,
                    streaming: false,
                    createdAt: new Date().toISOString(),
                },
            };
            yield { name: 'done', data: { closeKind } };
            return;
        }
    }
    readInt(key, fallback) {
        const raw = this.config.get(key, fallback);
        const value = Number(raw);
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }
    cancelled() {
        return { name: 'error', data: { code: 'cancelled', message: 'Turn cancelled' } };
    }
    registerTools(list) {
        return list.map((tool) => {
            const schema = tool.inputSchema ?? {};
            const hasFullShape = schema.type === 'object' ||
                (schema.properties != null && typeof schema.properties === 'object') ||
                Array.isArray(schema.required);
            const properties = (hasFullShape
                ? (schema.properties ?? {})
                : schema);
            const required = Array.isArray(schema.required)
                ? schema.required.filter((key) => typeof key === 'string')
                : [];
            const inputSchema = {
                type: 'object',
                properties,
            };
            if (required.length)
                inputSchema.required = required;
            if (schema.additionalProperties === false)
                inputSchema.additionalProperties = false;
            return {
                spec: { name: tool.name, description: tool.description, inputSchema },
                required,
            };
        });
    }
    invalidArgFields(call, tools) {
        const found = tools.find((tool) => tool.spec.name === call.name);
        if (!found)
            return [];
        const args = call.arguments ?? {};
        return found.required.filter((field) => args[field] === undefined || args[field] === null || args[field] === '');
    }
    /** Map common model aliases so strict schemas do not fail on the first try. */
    normalizeToolCallArgs(call) {
        const args = { ...(call.arguments ?? {}) };
        if (call.name === 'propose_plan' && Array.isArray(args.steps)) {
            args.steps = args.steps.map((step) => {
                if (!step || typeof step !== 'object' || Array.isArray(step))
                    return step;
                const row = { ...step };
                const tool = typeof row.tool === 'string' ? row.tool : '';
                if (tool !== 'create_call_group' && tool !== 'update_call_group')
                    return row;
                const stepArgs = row.args && typeof row.args === 'object' && !Array.isArray(row.args)
                    ? { ...row.args }
                    : {};
                return { ...row, args: this.normalizeCallGroupArgs(stepArgs) };
            });
        }
        if (call.name === 'create_call_group' || call.name === 'update_call_group') {
            return { ...call, arguments: this.normalizeCallGroupArgs(args) };
        }
        if (call.name === 'create_ivr' || call.name === 'update_ivr') {
            if (this.isBlank(args.name)) {
                const alias = args.title ?? args.label ?? args.ivr_name ?? args.menu_name;
                if (typeof alias === 'string' && alias.trim())
                    args.name = alias.trim();
            }
            if (!Array.isArray(args.menu_items) && Array.isArray(args.steps)) {
                args.menu_items = args.steps;
            }
            if (!Array.isArray(args.menu_items) && (args.digit != null || args.destination != null)) {
                args.menu_items = [{
                        digit: args.digit,
                        destination: args.destination,
                        ...(args.actions != null ? { actions: args.actions } : {}),
                    }];
                delete args.digit;
                delete args.destination;
                delete args.actions;
            }
            for (const key of ['title', 'label', 'ivr_name', 'menu_name', 'steps']) {
                delete args[key];
            }
        }
        return { ...call, arguments: args };
    }
    normalizeCallGroupArgs(raw) {
        const args = { ...raw };
        if (typeof args.exten === 'number' && Number.isFinite(args.exten)) {
            args.exten = String(Math.trunc(args.exten));
        }
        if (this.isBlank(args.exten)) {
            const alias = args.extension ?? args.number ?? args.group_exten ?? args.groupExten;
            if (typeof alias === 'number' && Number.isFinite(alias))
                args.exten = String(Math.trunc(alias));
            else if (typeof alias === 'string' && alias.trim())
                args.exten = alias.trim();
        }
        if (this.isBlank(args.name)) {
            const alias = args.title ?? args.label ?? args.group_name ?? args.groupName;
            if (typeof alias === 'string' && alias.trim())
                args.name = alias.trim();
        }
        if (args.members != null) {
            args.members = this.normalizeCallGroupMembers(args.members);
        }
        for (const key of [
            'extension',
            'number',
            'group_exten',
            'groupExten',
            'title',
            'label',
            'group_name',
            'groupName',
        ]) {
            delete args[key];
        }
        return args;
    }
    normalizeCallGroupMembers(raw) {
        if (typeof raw === 'string') {
            const trimmed = raw.trim();
            const range = trimmed.match(/^(\d{2,8})\s*[-–—]\s*(\d{2,8})$/);
            if (range) {
                const start = Number(range[1]);
                const end = Number(range[2]);
                if (Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 50) {
                    const parts = [];
                    for (let n = start; n <= end; n += 1)
                        parts.push(String(n));
                    return parts.map((value, index) => ({
                        member_type: 'internal',
                        value,
                        position: index,
                    }));
                }
            }
            const parts = trimmed
                .split(/[,;\s]+/)
                .map((part) => part.trim())
                .filter((part) => /^\d{2,8}$/.test(part));
            if (!parts.length)
                return raw;
            return parts.map((value, index) => ({
                member_type: 'internal',
                value,
                position: index,
            }));
        }
        if (!Array.isArray(raw))
            return raw;
        return raw.map((item, index) => {
            if (typeof item === 'string' || typeof item === 'number') {
                return { member_type: 'internal', value: String(item), position: index };
            }
            if (item && typeof item === 'object' && !Array.isArray(item)) {
                const row = { ...item };
                if (this.isBlank(row.value)) {
                    const alias = row.exten ?? row.extension ?? row.number ?? row.endpoint;
                    if (alias != null && String(alias).trim())
                        row.value = String(alias).trim();
                }
                if (this.isBlank(row.member_type))
                    row.member_type = 'internal';
                if (row.position == null)
                    row.position = index;
                return row;
            }
            return item;
        });
    }
    isBlank(value) {
        return value === undefined || value === null || value === '';
    }
    missingArgsHint(toolName, fields) {
        if (toolName === 'create_call_group') {
            return ('Required TOP-LEVEL fields: name (string), exten (string, 2–8 digits). ' +
                'Do NOT pass a single member object as the root. Members belong in members[]. Example: ' +
                '{"name":"101-103","exten":"9010","strategy":"ringall","members":[{"member_type":"internal","value":"101"},' +
                '{"member_type":"internal","value":"102"},{"member_type":"internal","value":"103"}]}. ' +
                'If group 9010 already exists, call create_ivr instead.');
        }
        if (toolName === 'create_ivr') {
            return ('Required TOP-LEVEL field: name. Do NOT pass one menu item as the root. ' +
                'Digits belong in menu_items[]. Example: ' +
                '{"name":"IVR - Продажи","prompts":[{"kind":"tts","engine_uid":1,"text":"..."}],' +
                '"menu_items":[{"digit":"1","destination":{"kind":"extension","target":"101"}},' +
                '{"digit":"2","destination":{"kind":"extension","target":"102"}},' +
                '{"digit":"3","destination":{"kind":"extension","target":"103"}},' +
                '{"digit":"t","destination":{"kind":"group","target":"9010"}}]}');
        }
        return `Provide missing fields: ${fields.join(', ')}`;
    }
    fragmentRetryHint(toolName) {
        if (toolName === 'create_ivr') {
            return ('create_ivr отклонён: корень должен быть {name, prompts, menu_items}, а не {digit, destination}. ' +
                'Вызови create_ivr ещё раз одним объектом: name="IVR - Продажи", пункты 1→101, 2→102, 3→103, t→group 9010.');
        }
        return ('create_call_group отклонён: нужны name + exten (+ members[]), не поля одного члена. ' +
            'Если группа 9010 уже создана — вызови create_ivr целиком, не create_call_group.');
    }
    async *closeAfterProposal(opts) {
        const closeKind = 'wait_confirm';
        const closing = '';
        await this.threads.appendMessage(opts.threadUid, opts.tenantUid, opts.authorUid, {
            role: 'assistant',
            content: closing,
            close_kind: closeKind,
            visibility: 'public',
            provider_model: opts.providerModel,
        });
        yield {
            name: 'item',
            data: {
                kind: 'assistant',
                id: `a${opts.threadUid}_plan`,
                text: closing,
                closeKind,
                streaming: false,
                createdAt: new Date().toISOString(),
            },
        };
        yield { name: 'done', data: { closeKind } };
    }
    async *tryServerIvrPlan(opts) {
        const draft = (0, ivr_setup_draft_1.buildIvrSetupDraft)(opts.message);
        if (!draft)
            return false;
        const stepId = `s${opts.threadUid}_plan`;
        yield { name: 'item', data: this.stepItem('propose_plan', stepId, false) };
        let resultText;
        try {
            const parts = await this.mcpTools.callTool('propose_plan', draft, opts.tenantUid, {
                userUid: opts.authorUid,
                role: opts.role,
                threadUid: opts.threadUid,
            });
            resultText = parts.map((part) => part.text).join('\n');
        }
        catch (err) {
            resultText = JSON.stringify({
                error: 'tool_failed',
                tool: 'propose_plan',
                message: err instanceof Error ? err.message : String(err),
            });
        }
        yield {
            name: 'item',
            data: this.stepItem('propose_plan', stepId, true, (0, agent_timeline_util_1.humanStepDetail)('propose_plan', resultText)),
        };
        const proposal = this.asProposalView(resultText);
        if (!proposal) {
            await this.threads.appendMessage(opts.threadUid, opts.tenantUid, opts.authorUid, {
                role: 'assistant',
                content: (0, shared_1.scrubToolIdsFromPublicText)(resultText).slice(0, 400) || 'Не удалось собрать план.',
                visibility: 'public',
                provider_model: opts.providerModel,
            });
            yield { name: 'error', data: { code: 'plan_compile_failed', message: resultText.slice(0, 400) } };
            yield { name: 'done', data: { closeKind: 'incomplete' } };
            return true;
        }
        const toolRow = await this.threads.appendMessage(opts.threadUid, opts.tenantUid, opts.authorUid, {
            role: 'tool',
            content: this.pendingProposalForModel('propose_plan', proposal),
            tool_name: 'propose_plan',
            proposal_id: proposal.id,
            provider_model: opts.providerModel,
        });
        yield {
            name: 'item',
            data: {
                kind: 'proposal',
                id: `p${toolRow.uid}`,
                card: proposal.card,
                createdAt: this.createdAtIso(toolRow.created_at),
            },
        };
        yield* this.closeAfterProposal({
            threadUid: opts.threadUid,
            tenantUid: opts.tenantUid,
            authorUid: opts.authorUid,
            locale: opts.locale,
            providerModel: opts.providerModel,
        });
        return true;
    }
    proposePlanShapeHint(args) {
        if (Array.isArray(args.steps) && args.steps.length)
            return null;
        const keys = Object.keys(args);
        const looksLikeGroup = keys.includes('exten') || keys.includes('members') || keys.includes('strategy');
        const looksLikeIvr = keys.includes('menu_items') || keys.includes('prompts') || keys.includes('text');
        if (!looksLikeGroup && !looksLikeIvr && typeof args.title === 'string') {
            return 'propose_plan требует steps[] — массив шагов {id, tool, args}, не пустой план.';
        }
        if (!looksLikeGroup && !looksLikeIvr)
            return null;
        return ('Это поля одной сущности, не план. propose_plan принимает только {title, steps[]}. Пример: '
            + '{"title":"IVR Рога и копыта","steps":['
            + '{"id":"g","tool":"create_call_group","args":{"name":"Рога и копыта","exten":"6001","strategy":"ringall",'
            + '"members":[{"member_type":"internal","value":"101"},{"member_type":"internal","value":"102"},{"member_type":"internal","value":"103"}]}},'
            + '{"id":"i","tool":"create_ivr","dependsOn":["g"],"args":{"name":"Рога и копыта","text":"<приветствие>",'
            + '"menu_items":[{"digit":"1","destination":{"kind":"extension","target":"101"}},'
            + '{"digit":"2","destination":{"kind":"extension","target":"102"}},'
            + '{"digit":"3","destination":{"kind":"extension","target":"103"}},'
            + '{"digit":"t","destination":{"kind":"group","target":"6001"}}]}}]}');
    }
    proposePlanNowReminder(locale, message = '') {
        const ru = (locale ?? 'ru').toLowerCase().startsWith('ru');
        if ((0, turn_outcome_util_1.looksLikeRouteSetup)(message) && !/календар|расписан|будн|выходн|schedule|calendar/i.test(message)) {
            return ru
                ? 'Создай запрошенный маршрут через create_route: context_uid из list_contexts, extensions — номера из запроса, actions — действия из list_dialplan_apps. '
                    + 'Для входа в существующее IVR используй toivr с params.ivr_uid из list_ivrs. Номер маршрута не является SIP-абонентом или цифрой IVR. '
                    + 'Не создавай абонента, меню или календарь вместо маршрута и не меняй существующее меню.'
                : 'Create the requested route with create_route (context_uid, extensions, actions). A route number is not a SIP endpoint or an IVR digit. '
                    + 'For an existing IVR use toivr with params.ivr_uid. Do not create endpoints, menus or calendars instead.';
        }
        if ((0, turn_outcome_util_1.looksLikeRouteSetup)(message) && /календар|расписан|будн|выходн|schedule|calendar/i.test(message)) {
            return ru
                ? 'Это маршрут, не новое меню. propose_plan: если календаря нет — шаг create_time_group '
                    + '(name + intervals[]), затем create_route. '
                    + 'create_route: {context_uid из list_contexts (sip-in), extensions:[DID], actions:['
                    + '{type:"toivr",params:{ivr_uid:<uid из list_ivrs>},condition:{time_group_uid:"steps.tg.result.uid"}}]}. '
                    + 'Календарь на действии — condition.time_group_uid, не отдельный tool schedule. '
                    + 'Не вызывай create_ivr и create_call_group. Не вызывай list_* снова.'
                : 'This is a route, not a new menu. If the calendar is missing, add create_time_group, then create_route. '
                    + 'Hang the calendar as condition.time_group_uid. Do not call create_ivr.';
        }
        return ru
            ? 'Факты уже собраны. Сразу вызови propose_plan одним объектом {title, steps[]}. '
                + 'Корень — не name/exten/members. Каждый шаг — объект {id,tool,args,dependsOn:[]}. '
                + 'Выбери инструменты только для запрошенных сущностей и скопируй структуру args из их JSON-схем. '
                + 'Не вызывай list_* снова.'
            : 'Facts are already collected. Call propose_plan as {title, steps[]}. '
                + 'Do not put name/exten/members at the root. Each step is {id,tool,args,dependsOn:[]}. '
                + 'Choose tools only for requested entities and use their exact argument schemas. '
                + 'Do not call list_* again.';
    }
    proposePlanCompileHint(resultText, message) {
        if (/WORKFLOW_UNKNOWN_TOOL:schedule/i.test(resultText)) {
            return 'schedule — не tool плана. Календарь создаёт create_time_group; на маршруте он вешается как condition.time_group_uid. '
                + 'Пример: {"title":"DID","steps":['
                + '{"id":"tg","tool":"create_time_group","args":{"name":"Рабочие","intervals":[{"time_start":"08:00","time_end":"17:00","days_of_week":"mon-fri"}]}},'
                + '{"id":"r","tool":"create_route","dependsOn":["tg"],"args":{"context_uid":2,"extensions":["2236263"],'
                + '"actions":[{"type":"toivr","params":{"ivr_uid":22},"condition":{"time_group_uid":"steps.tg.result.uid"}}]}}]}.';
        }
        if (/missing required parameter ivr_uid/i.test(resultText)) {
            return 'Шаг toivr требует params.ivr_uid (число из list_ivrs). Не создавай create_ivr, если меню уже есть.';
        }
        if ((0, turn_outcome_util_1.looksLikeRouteSetup)(message) && /ARGS_INVALID|invalid_arguments/i.test(resultText)) {
            return this.proposePlanNowReminder('ru', message);
        }
        return null;
    }
    pendingProposalForModel(toolName, proposal) {
        const label = typeof proposal.entityLabel === 'string' && proposal.entityLabel.trim()
            ? proposal.entityLabel.trim()
            : toolName;
        return `Черновик изменения подготовлен: ${label}. Карточка уже на экране — не пересказывай её и не называй, что осталось. Не пиши имена инструментов (create_endpoints_bulk, create_ivr, propose_plan), proposal, UUID, apply и тенантные идентификаторы вроде q701_0.`;
    }
    asProposalView(resultText) {
        try {
            const parsed = JSON.parse(resultText);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                return null;
            if ((0, agent_diff_dto_1.isWorkflowPlanView)(parsed)) {
                return { id: parsed.workflowId, card: 'workflow' };
            }
            if (typeof parsed.proposalId !== 'string')
                return null;
            if ('applyPayload' in parsed || 'apply_payload' in parsed)
                return null;
            return {
                id: parsed.proposalId,
                card: 'single',
                proposalId: parsed.proposalId,
                status: typeof parsed.status === 'string' ? parsed.status : undefined,
                entityLabel: typeof parsed.entityLabel === 'string' ? parsed.entityLabel : undefined,
            };
        }
        catch {
            return null;
        }
    }
    toLoopMessage(row) {
        if (row.role === 'tool') {
            return {
                role: 'tool',
                content: this.toModelToolContent(row.tool_name ?? 'unknown', this.truncateToolResult(row.content ?? '')),
                name: row.tool_name ?? undefined,
                tool_call_id: row.tool_call_id ?? undefined,
            };
        }
        const content = this.sanitizeAssistantHistory(row.role, row.content ?? '', row.tool_calls);
        return {
            role: row.role,
            content: content.length > exports.ASSISTANT_OUTPUT_BUDGET_CHARS
                ? `${content.slice(0, exports.ASSISTANT_OUTPUT_BUDGET_CHARS)}\n[truncated]`
                : content,
            tool_calls: this.normalizeHistoryToolCalls(row.tool_calls),
        };
    }
    /** Persist/replay shape → OpenAI assistant tool_calls (with required `type`). */
    normalizeHistoryToolCalls(raw) {
        if (!Array.isArray(raw) || !raw.length)
            return undefined;
        return raw.map((entry, index) => {
            const call = (entry && typeof entry === 'object' ? entry : {});
            const fn = (call.function && typeof call.function === 'object'
                ? call.function
                : null);
            if (fn) {
                return {
                    id: String(call.id ?? `call_${index + 1}`),
                    type: 'function',
                    function: {
                        name: String(fn.name ?? ''),
                        arguments: typeof fn.arguments === 'string'
                            ? fn.arguments
                            : JSON.stringify(fn.arguments ?? {}),
                    },
                };
            }
            return {
                id: String(call.id ?? `call_${index + 1}`),
                type: 'function',
                function: {
                    name: String(call.name ?? ''),
                    arguments: typeof call.arguments === 'string'
                        ? call.arguments
                        : JSON.stringify(call.arguments ?? {}),
                },
            };
        });
    }
    sanitizeAssistantHistory(role, content, toolCalls) {
        if (role !== 'assistant' || toolCalls)
            return content;
        if ((0, turn_outcome_util_1.looksTruncated)(content) || (0, turn_outcome_util_1.looksLikePlanningNarration)(content)) {
            return 'Предыдущий ответ оборвался без вызова инструмента. Сразу вызови create_ivr или list_call_groups, не пересказывай план.';
        }
        return content;
    }
    assistantToolMessage(text, toolCalls) {
        return {
            role: 'assistant',
            content: text || '',
            tool_calls: toolCalls.map((call) => ({
                id: call.id,
                type: 'function',
                function: { name: call.name, arguments: JSON.stringify(call.arguments) },
            })),
        };
    }
    toModelToolContent(toolName, content) {
        return (0, prompt_injection_util_1.wrapUntrustedData)(`tool:${toolName}`, content);
    }
    truncateToolResult(content) {
        if (content.length <= exports.TOOL_RESULT_MAX_CHARS)
            return content;
        return `${content.slice(0, exports.TOOL_RESULT_MAX_CHARS)}\n[truncated]`;
    }
    /**
     * OpenAI requires every assistant tool_call_id to have a following tool message.
     * Early exits (cancel / arg retries) must close the rest of the batch first.
     */
    async closeUnansweredToolCalls(opts) {
        for (const call of opts.toolCalls) {
            if (opts.answeredToolCallIds.has(call.id))
                continue;
            const content = JSON.stringify({
                error: opts.reason,
                tool: call.name,
                message: 'Tool call closed without execution to preserve OpenAI message order.',
            });
            await this.threads.appendMessage(opts.threadUid, opts.tenantUid, opts.authorUid, {
                role: 'tool',
                content,
                tool_name: call.name,
                tool_call_id: call.id,
                provider_model: opts.providerModel,
            });
            opts.messages.push({
                role: 'tool',
                content: this.toModelToolContent(call.name, content),
                tool_call_id: call.id,
                name: call.name,
            });
            opts.answeredToolCallIds.add(call.id);
        }
    }
    enforcePromptBudget(messages) {
        let total = messages.reduce((sum, msg) => sum + (msg.content?.length ?? 0), 0);
        while (total > exports.PROMPT_TOTAL_BUDGET_CHARS && messages.length > 2) {
            // Drop oldest non-system turn; if it is an assistant with tool_calls, drop
            // the following contiguous tool replies with it so pairs stay intact.
            const removed = messages.splice(1, 1)[0];
            total -= removed?.content?.length ?? 0;
            const callIds = new Set(Array.isArray(removed?.tool_calls)
                ? removed.tool_calls
                    .map((call) => (typeof call?.id === 'string' ? call.id : ''))
                    .filter(Boolean)
                : []);
            while (callIds.size && messages.length > 2 && messages[1]?.role === 'tool') {
                const toolMsg = messages[1];
                const toolCallId = typeof toolMsg.tool_call_id === 'string' ? toolMsg.tool_call_id : '';
                if (toolCallId && callIds.has(toolCallId)) {
                    messages.splice(1, 1);
                    total -= toolMsg.content?.length ?? 0;
                    callIds.delete(toolCallId);
                    continue;
                }
                break;
            }
        }
    }
    stepItem(tool, id, done, detail) {
        return {
            kind: 'step',
            id,
            labelKey: (0, agent_timeline_util_1.progressLabelKey)(tool),
            labelFallback: tool,
            ...(detail?.detailKey ? { detailKey: detail.detailKey } : {}),
            ...(detail?.detailFallback ? { detailFallback: detail.detailFallback } : {}),
            done,
            createdAt: new Date().toISOString(),
        };
    }
    createdAtIso(value) {
        if (value instanceof Date)
            return value.toISOString();
        if (typeof value === 'string' && value) {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime()))
                return parsed.toISOString();
        }
        return new Date().toISOString();
    }
};
exports.PbxAgentLoopService = PbxAgentLoopService;
exports.PbxAgentLoopService = PbxAgentLoopService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pbx_agent_llm_client_1.PbxAgentLlmClient,
        ai_providers_service_1.AiProvidersService,
        pbx_context_builder_service_1.PbxContextBuilderService,
        pbx_agent_thread_service_1.PbxAgentThreadService,
        mcp_tools_service_1.McpToolsService,
        config_1.ConfigService,
        ai_chat_settings_service_1.AiChatSettingsService,
        pbx_conversation_brief_service_1.PbxConversationBriefService,
        agent_intent_classifier_service_1.AgentIntentClassifierService,
        agent_skill_registry_service_1.AgentSkillRegistryService,
        pbx_workflow_runner_service_1.PbxWorkflowRunnerService])
], PbxAgentLoopService);
//# sourceMappingURL=pbx-agent-loop.service.js.map