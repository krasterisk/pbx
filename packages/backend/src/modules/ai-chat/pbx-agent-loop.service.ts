import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { wrapUntrustedData } from '../../shared/utils/prompt-injection.util';
import { AiProvidersService } from '../ai-agents/ai-providers.service';
import { McpToolsService } from '../mcp/mcp-tools.service';
import { PbxAgentLlmClient } from './pbx-agent-llm.client';
import { PbxContextBuilderService } from './pbx-context-builder.service';
import { PbxAgentThreadService } from './pbx-agent-thread.service';
import type { AgentSseEventName, AgentToolCall, AgentToolSpec, ChatMessage } from './pbx-agent.types';

export const DEFAULT_MAX_AGENT_STEPS = 12;
export const DEFAULT_TOOL_ARG_RETRIES = 1;

export interface AgentTurnContext {
  tenantUid: number;
  authorUid: number;
  role: number;
  locale?: string;
  signal?: AbortSignal;
}

export interface AgentStreamEvent {
  name: AgentSseEventName | 'proposal';
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

    await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
      role: 'user',
      content: message,
    });

    const provider = await this.providers.findDefaultLlm();
    if (!provider) {
      yield { name: 'error', data: { code: 'missing_llm', message: 'No language-model provider is configured' } };
      return;
    }

    const state = await this.contextBuilder.buildState(tenantUid);
    const systemPrompt = this.contextBuilder.buildSystemPrompt(state);
    const history = await this.threads.listMessages(threadUid, tenantUid, authorUid);
    const messages: LoopChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history
        .filter((row) => row.role !== 'system')
        .map((row) => this.toLoopMessage(row)),
    ];

    const registered = this.registerTools(this.mcpTools.getToolsList(tenantUid));
    const tools = registered.map((tool) => tool.spec);
    let steps = 0;

    while (true) {
      if (ctx.signal?.aborted) {
        yield this.cancelled();
        return;
      }
      if (steps >= maxSteps) {
        yield {
          name: 'error',
          data: { code: 'max_steps_exceeded', message: 'Step ceiling reached', maxSteps },
        };
        return;
      }
      steps += 1;

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

      const toolCalls = completion.toolCalls ?? [];
      if (toolCalls.length) {
        await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
          role: 'assistant',
          content: completion.text || null,
          tool_calls: toolCalls,
        });
        messages.push(this.assistantToolMessage(completion.text, toolCalls));

        for (const call of toolCalls) {
          if (ctx.signal?.aborted) {
            yield this.cancelled();
            return;
          }

          yield {
            name: 'progress',
            data: {
              tool: call.name,
              label: this.progressLabel(call.name, ctx.locale),
            },
          };
          yield { name: 'tool_call', data: { name: call.name, arguments: call.arguments } };

          const invalidFields = this.invalidArgFields(call, registered);
          if (invalidFields.length) {
            const failures = (argFailures.get(call.name) ?? 0) + 1;
            argFailures.set(call.name, failures);
            if (failures > argRetries) {
              yield {
                name: 'error',
                data: {
                  code: 'tool_arg_retries_exceeded',
                  message: `Invalid arguments for ${call.name}`,
                  fields: invalidFields,
                  tool: call.name,
                },
              };
              return;
            }
            const errorText = JSON.stringify({
              error: 'invalid_arguments',
              fields: invalidFields,
              tool: call.name,
            });
            yield { name: 'tool_result', data: { name: call.name, result: errorText } };
            await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
              role: 'tool',
              content: errorText,
              tool_name: call.name,
            });
            messages.push({
              role: 'tool',
              content: this.toModelToolContent(call.name, errorText),
              tool_call_id: call.id,
              name: call.name,
            });
            continue;
          }

          const parts = await this.mcpTools.callTool(call.name, call.arguments, tenantUid, {
            userUid: authorUid,
            role,
            threadUid,
          });
          const resultText = parts.map((part) => part.text).join('\n');
          const proposal = this.asProposalView(resultText);

          yield { name: 'tool_result', data: { name: call.name, result: resultText } };
          if (proposal) {
            yield { name: 'proposal', data: proposal };
          }

          const persisted = proposal
            ? `Pending proposal ${proposal.proposalId}`
            : resultText;
          await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
            role: 'tool',
            content: persisted,
            tool_name: call.name,
            proposal_id: proposal?.proposalId ?? null,
          });
          messages.push({
            role: 'tool',
            content: this.toModelToolContent(call.name, proposal ? persisted : resultText),
            tool_call_id: call.id,
            name: call.name,
          });
        }
        continue;
      }

      const text = completion.text ?? '';
      yield { name: 'text', data: text };
      await this.threads.appendMessage(threadUid, tenantUid, authorUid, {
        role: 'assistant',
        content: text,
      });
      yield { name: 'done', data: { totalLength: text.length } };
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
      const properties = (schema.properties ?? schema) as Record<string, unknown>;
      const required = Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === 'string') : [];
      return {
        spec: { name: tool.name, description: tool.description, inputSchema: properties },
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

  private asProposalView(resultText: string): { proposalId: string; status?: string } | null {
    try {
      const parsed = JSON.parse(resultText) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      if (typeof parsed.proposalId !== 'string') return null;
      if ('applyPayload' in parsed || 'apply_payload' in parsed) return null;
      return parsed as { proposalId: string; status?: string };
    } catch {
      return null;
    }
  }

  private toLoopMessage(row: {
    role: string;
    content: string | null;
    tool_name?: string | null;
    tool_calls?: unknown;
  }): LoopChatMessage {
    if (row.role === 'tool') {
      return {
        role: 'tool' as LoopChatMessage['role'],
        content: this.toModelToolContent(row.tool_name ?? 'unknown', row.content ?? ''),
        name: row.tool_name ?? undefined,
      };
    }
    return {
      role: row.role as LoopChatMessage['role'],
      content: row.content ?? '',
      tool_calls: row.tool_calls ?? undefined,
    };
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

  private progressLabel(tool: string, locale?: string): string {
    const ru = (locale ?? 'ru').toLowerCase().startsWith('ru');
    return ru ? `Выполняю ${tool}` : `Running ${tool}`;
  }
}
