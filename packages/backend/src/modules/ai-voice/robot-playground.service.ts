import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { AI_ROBOT_TEMPLATES, applyRobotTemplate, validateAiVoiceConfig, type AiVoiceRobotConfig } from '@krasterisk/shared';
import { AiProvidersService } from '../ai-connectivity/ai-providers.service';
import { applyProviderAuth } from '../ai-connectivity/provider-auth';
import { resolveChatCompletionsUrl } from '../ai-connectivity/chat-endpoint.util';
import { KnowledgeService } from '../knowledge/knowledge.service';
import {
  runConversation, type EngineMessage, type EngineTool, type LlmComplete,
} from './conversation-engine';

@Injectable()
export class RobotPlaygroundService {
  constructor(
    private readonly providers: AiProvidersService,
    private readonly knowledge: KnowledgeService,
  ) {}

  templates() {
    return AI_ROBOT_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));
  }

  fromTemplate(id: string): AiVoiceRobotConfig {
    const config = applyRobotTemplate(id);
    if (!config) throw new BadRequestException({ code: 'template_not_found' });
    return config;
  }

  async run(tenantUid: number, input: {
    config: AiVoiceRobotConfig;
    history?: EngineMessage[];
    userText: string;
    variables?: Record<string, string>;
  }) {
    const issues = validateAiVoiceConfig({ ...input.config, modelProfileId: input.config.modelProfileId || 1 });
    const blocking = issues.filter(issue => issue.field !== 'modelProfileId' && issue.field !== 'sttProfileId' && issue.field !== 'ttsProfileId');
    if (blocking.length) throw new BadRequestException({ code: 'invalid_robot_configuration', issues: blocking });
    if (!input.config.modelProfileId) throw new BadRequestException({ code: 'provider_unavailable' });
    const complete = await this.llm(tenantUid, input.config.modelProfileId);
    const search = this.knowledgeTool(tenantUid, input.config.knowledgeBaseIds);
    return runConversation({
      config: input.config, history: input.history ?? [], userText: input.userText,
      variables: input.variables, tools: search ? [search] : [], complete,
    });
  }

  private knowledgeTool(tenantUid: number, baseIds: string[]): EngineTool | null {
    if (!baseIds.length) return null;
    return {
      name: 'search_knowledge',
      description: 'Найти ответ в подключённых базах знаний',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      execute: async (args) => {
        const hits = await this.knowledge.searchBases(tenantUid, baseIds, String(args.query ?? ''));
        return { citations: hits.map(hit => hit.excerpt), hits };
      },
    };
  }

  private async llm(tenantUid: number, providerUid: number): Promise<LlmComplete> {
    const revision = await this.revision(tenantUid, providerUid);
    const row = await this.providers.findOne(providerUid, tenantUid);
    const secret = await this.providers.resolveCredential(revision.credentialRef);
    const url = resolveChatCompletionsUrl(revision.config.endpoint);
    if (!url) throw new BadRequestException({ code: 'provider_unavailable' });
    const headers = applyProviderAuth({ 'Content-Type': 'application/json' }, revision.config.authType, secret);
    const model = typeof row.defaults?.model === 'string' && row.defaults.model ? row.defaults.model : 'gpt-4o-mini';
    return async ({ messages, tools }) => {
      const response = await axios.post(url, {
        model: model || 'gpt-4o-mini',
        temperature: 0.4,
        messages: messages.map(message => ({
          role: message.role, content: message.content,
          ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
          ...(message.name ? { name: message.name } : {}),
        })),
        tools: tools.map(tool => ({
          type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        })),
      }, { headers, timeout: 30000, validateStatus: () => true });
      if (response.status >= 400) throw new BadRequestException({ code: 'provider_unavailable' });
      const message = response.data?.choices?.[0]?.message ?? {};
      const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls.map((call: { id: string; function?: { name?: string; arguments?: string } }) => ({
        id: call.id, name: call.function?.name || '',
        arguments: parseArgs(call.function?.arguments),
      })) : [];
      return { text: typeof message.content === 'string' ? message.content : '', toolCalls };
    };
  }

  private async revision(tenantUid: number, providerUid: number) {
    try {
      return await this.providers.revisionForOperation(tenantUid, providerUid, 'llm');
    } catch {
      return this.providers.revisionForOperation(tenantUid, providerUid, 'realtime');
    }
  }
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
