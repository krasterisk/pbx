import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AgentItemVisibility, AgentTimelineStepItem, AgentTurnCloseKind } from '@krasterisk/shared';
import { wrapUntrustedData } from '../../shared/utils/prompt-injection.util';
import { AiProvidersService } from '../ai-agents/ai-providers.service';
import { McpToolsService } from '../mcp/mcp-tools.service';
import { PbxAgentLlmClient } from './pbx-agent-llm.client';
import { PbxContextBuilderService } from './pbx-context-builder.service';
import { PbxAgentThreadService } from './pbx-agent-thread.service';
import { PbxConversationBriefService } from './pbx-conversation-brief.service';
import { AgentIntentClassifierService } from './agent-intent-classifier.service';
import { AgentSkillRegistryService } from '../ai-platform/agent-skill-registry.service';
import { renderBriefForPrompt } from './conversation-brief.types';
import { AiChatSettingsService } from './ai-chat-settings.service';
import { progressLabelKey } from './agent-timeline.util';
import type { AgentSseEventName, AgentToolCall, AgentToolSpec, ChatMessage } from './pbx-agent.types';
import {
  classifyTurnClose,
  forcedTurnStatus,
  incompleteReminder,
  looksLikePlanningNarration,
  looksTruncated,
} from './turn-outcome.util';
import { isWorkflowPlanView } from './dto/agent-diff.dto';

export const DEFAULT_MAX_AGENT_STEPS = 12;
export const DEFAULT_TOOL_ARG_RETRIES = 1;
export const TOOL_RESULT_MAX_CHARS = 4000;
export const ASSISTANT_OUTPUT_BUDGET_CHARS = 8000;
export const PROMPT_TOTAL_BUDGET_CHARS = 48_000;

export const CONTINUE_AFTER_APPLY_PROMPT =
  'Карточка применена. Продолжи исходный запрос: создай недостающие сущности инструментами. ' +
  'Не переспрашивай TTS и номер группы.';

export interface AgentTurnContext {
  tenantUid: number;
  authorUid: number;
  role: number;
  locale?: string;
  signal?: AbortSignal;
  userVisibility?: AgentItemVisibility;
}

export interface AgentStreamEvent {
  name: AgentSseEventName;
  data: unknown;
}

type LoopChatMessage = ChatMessage & {
  tool_call_id?: string;
  name?: string;
  tool_calls?: unknown;
};

interface RegisteredTool {
  spec: AgentToolSpec;
  required: string[];
}

@Injectable()
export class PbxAgentLoopService {
  constructor(
    private readonly llm: PbxAgentLlmClient,
    private readonly providers: AiProvidersService,
    private readonly contextBuilder: PbxContextBuilderService,
    private readonly threads: PbxAgentThreadService,
    private readonly mcpTools: McpToolsService,
    private readonly config: ConfigService,
    private readonly chatSettings: AiChatSettingsService,
    private readonly briefService: PbxConversationBriefService,
    private readonly intentClassifier: AgentIntentClassifierService,
    private readonly skillRegistry: AgentSkillRegistryService,
  ) {}

  /**
   * One user message → in-process model/tool cycle (D-06).
   * Persist as you go so a dropped connection still leaves a readable thread (D-26).
   */
  async *runTurn(
    message: string,
    conversation: { uid: number },
    ctx: AgentTurnContext,
  ): AsyncGenerator<AgentStreamEvent> {
    const threadUid = conversation.uid;
    const { tenantUid, authorUid, role } = ctx;
    const maxSteps = this.readInt('CC_AI_MAX_AGENT_STEPS', DEFAULT_MAX_AGENT_STEPS);
    const argRetries = this.readInt('CC_AI_TOOL_ARG_RETRIES', DEFAULT_TOOL_ARG_RETRIES);
    const argFailures = new Map<string, number>();

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
      briefText: renderBriefForPrompt(brief),
      locale: ctx.locale,
      selectedSkillBodies,
    });
    const history = await this.threads.listMessagesForReplay(threadUid, tenantUid, authorUid);
    const messages: LoopChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history
        .filter((row) => row.role !== 'system')
        .map((row) => this.toLoopMessage(row)),
    ];
    this.enforcePromptBudget(messages);

    const allTools = this.mcpTools.getToolsList(tenantUid);
    const allowedNames = new Set(
      this.intentClassifier.filterToolNames(
        allTools.map((tool) => tool.name),
        classification,
      ),
    );
    const registered = this.registerTools(allTools.filter((tool) => allowedNames.has(tool.name)));
    const tools = registered.map((tool) => tool.spec);
    let steps = 0;
    let incompleteContinues = 0;
    let forceToolChoice = false;
    let calledToolThisTurn = false;
    let hadProposal = false;
    let mutationsThisTurn = 0;
    let lastAssistant = '';
    const providerModel =
      typeof (provider.defaults as Record<string, unknown> | null)?.model === 'string'
        ? String((provider.defaults as Record<string, unknown>).model)
        : provider.name;

    if (this.looksLikeUserConfirm(message)) {
      messages.push({
        role: 'system',
        content:
          'Пользователь подтвердил. Не вызывай create_call_group снова и не передавай поля одного члена (member_type/value) как аргументы группы. ' +
          'Если группа таймаута уже есть (например exten 9010), сразу вызови create_ivr с подтверждёнными name/prompts/menu_items (t → kind group, target 9010). ' +
          'Карточку в UI подтверждает пользователь — не придумывай apply tool.',
      });
      forceToolChoice = true;
    }

    // Clear multi-domain configure briefs should start by calling tools, not narrating.
    const preferTools =
      classification.confidence >= 0.5 &&
      classification.skillNames.some((name) =>
        ['ivrs', 'endpoints', 'call-groups', 'queues', 'routes', 'trunks', 'pbx-setup'].includes(name),
      );

    while (true) {
      if (ctx.signal?.aborted) {
        yield this.cancelled();
        return;
      }
      if (steps >= maxSteps) {
        const status = forcedTurnStatus({ locale: ctx.locale, hadProposal, lastAssistant });
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

      const requireTools =
        tools.length > 0 &&
        (forceToolChoice || (preferTools && !calledToolThisTurn && !hadProposal));

      const completion = await this.llm.chat({
        provider: {
          uid: provider.uid,
          name: provider.name,
          endpoint: provider.endpoint,
          auth_type: provider.auth_type,
          encrypted_api_key: provider.encrypted_api_key,
          capabilities: provider.capabilities,
          defaults: provider.defaults as Record<string, unknown> | null,
          vendor: provider.vendor,
        },
        messages: messages as ChatMessage[],
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
        yield { name: 'error', data: completion.error };
        return;
      }

      const text = completion.text ?? '';
      const toolCalls = [...(completion.toolCalls ?? [])];

      if (toolCalls.length) {
        calledToolThisTurn = true;
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
        const answeredToolCallIds = new Set<string>();

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

          if (this.mcpTools.isMutationTool(normalizedCall.name)) {
            mutationsThisTurn += 1;
            if (mutationsThisTurn >= 2) {
              const refusal = JSON.stringify({
                error: 'batch_required',
                tool: normalizedCall.name,
                hint: 'Вторая мутация за ход запрещена. Собери оставшиеся изменения в один propose_plan '
                    + '(шаги ссылаются друг на друга через steps.<id>.result.<поле>) и вызови его вместо серии create_*.',
              });
              // tool-строка обязательна: OpenAI требует ответ на каждый tool_call_id
              yield { name: 'item', data: this.stepItem(normalizedCall.name, stepId, true) };
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
            yield { name: 'item', data: this.stepItem(normalizedCall.name, stepId, true) };
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

          let resultText: string;
          try {
            const parts = await this.mcpTools.callTool(normalizedCall.name, normalizedCall.arguments, tenantUid, {
              userUid: authorUid,
              role,
              threadUid,
            });
            resultText = parts.map((part) => part.text).join('\n');
          } catch (err) {
            resultText = JSON.stringify({
              error: 'tool_failed',
              tool: normalizedCall.name,
              message: err instanceof Error ? err.message : String(err),
            });
          }
          const proposal = this.asProposalView(resultText);
          resultText = this.truncateToolResult(resultText);

          yield { name: 'item', data: this.stepItem(normalizedCall.name, stepId, true) };

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
          messages.push({
            role: 'tool',
            content: this.toModelToolContent(normalizedCall.name, proposal ? persisted : resultText),
            tool_call_id: normalizedCall.id,
            name: normalizedCall.name,
          });
          answeredToolCallIds.add(normalizedCall.id);
        }
        continue;
      }

      const close = classifyTurnClose(text, {
        hadProposal,
        truncated: completion.finishReason === 'length' || looksTruncated(text),
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
        if (emptyNoTools && tools.length) {
          forceToolChoice = true;
        }
        const maxIncomplete = forceToolChoice ? 3 : 2;
        if (incompleteContinues <= maxIncomplete) {
          messages.push({
            role: 'system',
            content: incompleteReminder(ctx.locale, classification.skillNames),
          });
          continue;
        }
        const status = forcedTurnStatus({ locale: ctx.locale, hadProposal, lastAssistant });
        await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
          role: 'assistant',
          content: status,
          visibility: 'internal',
        });
        yield { name: 'done', data: { closeKind: 'complete' } };
        return;
      }

      forceToolChoice = false;

      const closeKind: AgentTurnCloseKind = close;
      const closing = text || forcedTurnStatus({ locale: ctx.locale, hadProposal, lastAssistant });
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

  private readInt(key: string, fallback: number): number {
    const raw = this.config.get<number>(key, fallback);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private cancelled(): AgentStreamEvent {
    return { name: 'error', data: { code: 'cancelled', message: 'Turn cancelled' } };
  }

  private registerTools(
    list: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>,
  ): RegisteredTool[] {
    return list.map((tool) => {
      const schema = tool.inputSchema ?? {};
      const hasFullShape =
        schema.type === 'object' ||
        (schema.properties != null && typeof schema.properties === 'object') ||
        Array.isArray(schema.required);
      const properties = (
        hasFullShape
          ? ((schema.properties as Record<string, unknown> | undefined) ?? {})
          : schema
      ) as Record<string, unknown>;
      const required = Array.isArray(schema.required)
        ? schema.required.filter((key): key is string => typeof key === 'string')
        : [];
      const inputSchema: Record<string, unknown> = {
        type: 'object',
        properties,
      };
      if (required.length) inputSchema.required = required;
      if (schema.additionalProperties === false) inputSchema.additionalProperties = false;
      return {
        spec: { name: tool.name, description: tool.description, inputSchema },
        required,
      };
    });
  }

  private invalidArgFields(call: AgentToolCall, tools: RegisteredTool[]): string[] {
    const found = tools.find((tool) => tool.spec.name === call.name);
    if (!found) return [];
    const args = call.arguments ?? {};
    return found.required.filter((field) => args[field] === undefined || args[field] === null || args[field] === '');
  }

  /** Map common model aliases so strict schemas do not fail on the first try. */
  private normalizeToolCallArgs(call: AgentToolCall): AgentToolCall {
    const args = { ...(call.arguments ?? {}) } as Record<string, unknown>;
    if (call.name === 'create_call_group' || call.name === 'update_call_group') {
      if (this.isBlank(args.exten)) {
        const alias = args.extension ?? args.number ?? args.group_exten ?? args.groupExten;
        if (typeof alias === 'string' && alias.trim()) args.exten = alias.trim();
      }
      if (this.isBlank(args.name)) {
        const alias = args.title ?? args.label ?? args.group_name ?? args.groupName;
        if (typeof alias === 'string' && alias.trim()) args.name = alias.trim();
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
    }
    if (call.name === 'create_ivr' || call.name === 'update_ivr') {
      if (this.isBlank(args.name)) {
        const alias = args.title ?? args.label ?? args.ivr_name ?? args.menu_name;
        if (typeof alias === 'string' && alias.trim()) args.name = alias.trim();
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

  private normalizeCallGroupMembers(raw: unknown): unknown {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      const range = trimmed.match(/^(\d{2,8})\s*[-–—]\s*(\d{2,8})$/);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 50) {
          const parts: string[] = [];
          for (let n = start; n <= end; n += 1) parts.push(String(n));
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
      if (!parts.length) return raw;
      return parts.map((value, index) => ({
        member_type: 'internal',
        value,
        position: index,
      }));
    }
    if (!Array.isArray(raw)) return raw;
    return raw.map((item, index) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return { member_type: 'internal', value: String(item), position: index };
      }
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const row = { ...(item as Record<string, unknown>) };
        if (this.isBlank(row.value)) {
          const alias = row.exten ?? row.extension ?? row.number ?? row.endpoint;
          if (alias != null && String(alias).trim()) row.value = String(alias).trim();
        }
        if (this.isBlank(row.member_type)) row.member_type = 'internal';
        if (row.position == null) row.position = index;
        return row;
      }
      return item;
    });
  }

  private isBlank(value: unknown): boolean {
    return value === undefined || value === null || value === '';
  }

  private missingArgsHint(toolName: string, fields: string[]): string {
    if (toolName === 'create_call_group') {
      return (
        'Required TOP-LEVEL fields: name (string), exten (string, 2–8 digits). ' +
        'Do NOT pass a single member object as the root. Members belong in members[]. Example: ' +
        '{"name":"101-103","exten":"9010","strategy":"ringall","members":[{"member_type":"internal","value":"101"},' +
        '{"member_type":"internal","value":"102"},{"member_type":"internal","value":"103"}]}. ' +
        'If group 9010 already exists, call create_ivr instead.'
      );
    }
    if (toolName === 'create_ivr') {
      return (
        'Required TOP-LEVEL field: name. Do NOT pass one menu item as the root. ' +
        'Digits belong in menu_items[]. Example: ' +
        '{"name":"IVR - Продажи","prompts":[{"kind":"tts","engine_uid":1,"text":"..."}],' +
        '"menu_items":[{"digit":"1","destination":{"kind":"extension","target":"101"}},' +
        '{"digit":"2","destination":{"kind":"extension","target":"102"}},' +
        '{"digit":"3","destination":{"kind":"extension","target":"103"}},' +
        '{"digit":"t","destination":{"kind":"group","target":"9010"}}]}'
      );
    }
    return `Provide missing fields: ${fields.join(', ')}`;
  }

  private fragmentRetryHint(toolName: string): string {
    if (toolName === 'create_ivr') {
      return (
        'create_ivr отклонён: корень должен быть {name, prompts, menu_items}, а не {digit, destination}. ' +
        'Вызови create_ivr ещё раз одним объектом: name="IVR - Продажи", пункты 1→101, 2→102, 3→103, t→group 9010.'
      );
    }
    return (
      'create_call_group отклонён: нужны name + exten (+ members[]), не поля одного члена. ' +
      'Если группа 9010 уже создана — вызови create_ivr целиком, не create_call_group.'
    );
  }

  private looksLikeUserConfirm(message: string): boolean {
    const text = String(message ?? '').trim().toLowerCase();
    if (!text) return false;
    return /^(да[,!.\s]*)?(подтверждаю|подтверждаю|согласен|ок[,!.\s]+делай|делай|применяй|apply)\b/.test(text)
      || /подтверждаю[,!.\s]+делай/.test(text);
  }

  private pendingProposalForModel(
    toolName: string,
    proposal: { proposalId?: string; entityLabel?: string },
  ): string {
    const label = typeof proposal.entityLabel === 'string' && proposal.entityLabel.trim()
      ? proposal.entityLabel.trim()
      : toolName;
    return `Черновик изменения подготовлен: ${label}. Попроси пользователя подтвердить карточку. Назови, что ещё осталось после подтверждения. Не останавливайся молча. Не упоминай proposal, UUID, apply tool и тенантные идентификаторы вроде q701_0.`;
  }

  private asProposalView(resultText: string): {
    id: string;
    card: 'single' | 'workflow';
    proposalId?: string;
    status?: string;
    entityLabel?: string;
  } | null {
    try {
      const parsed = JSON.parse(resultText) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      if (isWorkflowPlanView(parsed)) {
        return { id: parsed.workflowId, card: 'workflow' };
      }
      if (typeof parsed.proposalId !== 'string') return null;
      if ('applyPayload' in parsed || 'apply_payload' in parsed) return null;
      return {
        id: parsed.proposalId,
        card: 'single',
        proposalId: parsed.proposalId,
        status: typeof parsed.status === 'string' ? parsed.status : undefined,
        entityLabel: typeof parsed.entityLabel === 'string' ? parsed.entityLabel : undefined,
      };
    } catch {
      return null;
    }
  }

    private toLoopMessage(row: {
    role: string;
    content: string | null;
    tool_name?: string | null;
    tool_calls?: unknown;
    tool_call_id?: string | null;
  }): LoopChatMessage {
    if (row.role === 'tool') {
      return {
        role: 'tool' as LoopChatMessage['role'],
        content: this.toModelToolContent(row.tool_name ?? 'unknown', this.truncateToolResult(row.content ?? '')),
        name: row.tool_name ?? undefined,
        tool_call_id: row.tool_call_id ?? undefined,
      };
    }
    const content = this.sanitizeAssistantHistory(row.role, row.content ?? '', row.tool_calls);
    return {
      role: row.role as LoopChatMessage['role'],
      content: content.length > ASSISTANT_OUTPUT_BUDGET_CHARS
        ? `${content.slice(0, ASSISTANT_OUTPUT_BUDGET_CHARS)}\n[truncated]`
        : content,
      tool_calls: this.normalizeHistoryToolCalls(row.tool_calls),
    };
  }

  /** Persist/replay shape → OpenAI assistant tool_calls (with required `type`). */
  private normalizeHistoryToolCalls(raw: unknown): LoopChatMessage['tool_calls'] {
    if (!Array.isArray(raw) || !raw.length) return undefined;
    return raw.map((entry, index) => {
      const call = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      const fn = (call.function && typeof call.function === 'object'
        ? call.function
        : null) as Record<string, unknown> | null;
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

  private sanitizeAssistantHistory(role: string, content: string, toolCalls: unknown): string {
    if (role !== 'assistant' || toolCalls) return content;
    if (looksTruncated(content) || looksLikePlanningNarration(content)) {
      return 'Предыдущий ответ оборвался без вызова инструмента. Сразу вызови create_ivr или list_call_groups, не пересказывай план.';
    }
    return content;
  }

  private assistantToolMessage(text: string, toolCalls: AgentToolCall[]): LoopChatMessage {
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

  private toModelToolContent(toolName: string, content: string): string {
    return wrapUntrustedData(`tool:${toolName}`, content);
  }

  private truncateToolResult(content: string): string {
    if (content.length <= TOOL_RESULT_MAX_CHARS) return content;
    return `${content.slice(0, TOOL_RESULT_MAX_CHARS)}\n[truncated]`;
  }

  /**
   * OpenAI requires every assistant tool_call_id to have a following tool message.
   * Early exits (cancel / arg retries) must close the rest of the batch first.
   */
  private async closeUnansweredToolCalls(opts: {
    toolCalls: AgentToolCall[];
    answeredToolCallIds: Set<string>;
    messages: LoopChatMessage[];
    threadUid: number;
    tenantUid: number;
    authorUid: number;
    providerModel: string;
    reason: string;
  }): Promise<void> {
    for (const call of opts.toolCalls) {
      if (opts.answeredToolCallIds.has(call.id)) continue;
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

  private enforcePromptBudget(messages: LoopChatMessage[]): void {
    let total = messages.reduce((sum, msg) => sum + (msg.content?.length ?? 0), 0);
    while (total > PROMPT_TOTAL_BUDGET_CHARS && messages.length > 2) {
      // Drop oldest non-system turn; if it is an assistant with tool_calls, drop
      // the following contiguous tool replies with it so pairs stay intact.
      const removed = messages.splice(1, 1)[0];
      total -= removed?.content?.length ?? 0;
      const callIds = new Set(
        Array.isArray(removed?.tool_calls)
          ? (removed.tool_calls as Array<{ id?: string }>)
              .map((call) => (typeof call?.id === 'string' ? call.id : ''))
              .filter(Boolean)
          : [],
      );
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

  private stepItem(tool: string, id: string, done: boolean): AgentTimelineStepItem {
    return {
      kind: 'step',
      id,
      labelKey: progressLabelKey(tool),
      labelFallback: tool,
      done,
      createdAt: new Date().toISOString(),
    };
  }

  private createdAtIso(value: Date | string | null | undefined): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' && value) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return new Date().toISOString();
  }

}
