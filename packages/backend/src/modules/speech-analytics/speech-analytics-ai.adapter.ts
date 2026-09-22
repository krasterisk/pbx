/**
 * RED stub for 18-15 Task 2 — tools exist but omit D-33/D-27 behavior so specs fail on assertions.
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import type {
  AgentDiffProposal,
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';

@Injectable()
export class SpeechAnalyticsAiAdapter implements DomainAiAdapter, OnModuleInit {
  readonly domain = 'speech-analytics';

  constructor(
    _moduleSettings: unknown,
    _projects: unknown,
    _tokens: unknown,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    /* stub: does not register */
  }

  getTools(): AiToolDefinition[] {
    const emptyMutation = {
      schemaVersion: 'sa-stub-1',
      input: { parse: (v: unknown) => v, safeParse: (v: unknown) => ({ success: true, data: v }) } as any,
      args: { parse: (v: unknown) => v, safeParse: (v: unknown) => ({ success: true, data: v }) } as any,
      reload: { kind: 'none' as const },
      propose: async () => ({ refused: true as const, message: 'stub' }),
      revalidate: async (args: any) => ({ ok: true as const, args }),
      apply: async () => ({}),
    };
    return [
      {
        name: 'pause_speech_analytics',
        description: 'stub',
        inputSchema: {},
        entityType: 'speech_analytics',
        proposes: true,
        mutation: emptyMutation as any,
        handler: async () => ({
          entityType: 'speech_analytics',
          entityLabel: 'pause',
          summary: [],
          before: null,
          after: { pauseNew: false },
          applyPayload: { tool: 'pause_speech_analytics', args: {} },
          includesDialplanReload: false,
        }),
      },
      {
        name: 'edit_speech_analytics_project',
        description: 'stub',
        inputSchema: {},
        entityType: 'speech_analytics_project',
        proposes: true,
        mutation: emptyMutation as any,
        handler: async () => ({
          entityType: 'speech_analytics_project',
          entityLabel: 'project',
          summary: [],
          before: null,
          after: { publish: false },
          applyPayload: { tool: 'edit_speech_analytics_project', args: {} },
          includesDialplanReload: false,
        }),
      },
      {
        name: 'issue_speech_analytics_token',
        description: 'stub',
        inputSchema: {},
        entityType: 'speech_analytics_token',
        proposes: true,
        mutation: {
          ...emptyMutation,
          apply: async () => ({ secret: 'sa-secret-ONCE-only' }),
        } as any,
        handler: async () => ({
          entityType: 'speech_analytics_token',
          entityLabel: 'token',
          summary: [],
          before: null,
          after: { secret: 'sa-secret-ONCE-only', secretOnce: false },
          applyPayload: { tool: 'issue_speech_analytics_token', args: {} },
          includesDialplanReload: false,
        }),
      },
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: async () => '' };
  }

  getKnowledgeBlock(): string {
    return '';
  }

  toChatHistoryProposal(proposal: AgentDiffProposal): AgentDiffProposal {
    return proposal;
  }
}
