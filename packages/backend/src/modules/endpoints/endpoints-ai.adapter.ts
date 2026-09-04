import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EndpointsService } from './endpoints.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
  AgentDiffProposal,
} from '../ai-platform/ai-adapter.types';

const DEFAULT_EXTENSION_START = 200;
const CREDENTIALS_NOTE =
  'Учётные данные доступны на экране абонента — пароль в переписку не попадает.';

/**
 * EndpointsAiAdapter — subscriber (SIP endpoint) mutations as proposals (D-18).
 * Credential generation lives in EndpointsService, never in this layer.
 */
@Injectable()
export class EndpointsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(EndpointsAiAdapter.name);
  readonly domain = 'endpoints';

  constructor(
    private readonly endpointsService: EndpointsService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('EndpointsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [this.toolCreateEndpoint()];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Абоненты (Endpoints)
- Абонент = внутренний номер (extension) + контекст маршрутизации. SIP ID собирается как e{extension}_{tenant}.
- Пароль генерирует сервис абонентов при подтверждении. В карточке и ответе инструмента пароля нет — он на экране абонента.
- Если номер или контекст не названы, берутся из уже существующих абонентов этого тенанта (следующий свободный номер, их контекст).`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const endpoints = await this.endpointsService.findAll(vpbxUserUid);
    if (endpoints.length === 0) return '';
    return `Абоненты: ${endpoints.length}`;
  }

  private toolCreateEndpoint(): AiToolDefinition {
    return {
      name: 'create_endpoint',
      description:
        'Предлагает создать одного SIP-абонента. Номер и контекст по умолчанию берутся из абонентов тенанта. Пароль не возвращается.',
      inputSchema: {
        extension: { type: 'string', description: 'Номер абонента. Если не указан — следующий свободный у тенанта.' },
        name: { type: 'string', description: 'Отображаемое имя' },
        displayName: { type: 'string', description: 'Псевдоним для name' },
        context: { type: 'string', description: 'Контекст маршрутизации. Если не указан — контекст существующих абонентов.' },
        codecs: { type: 'string' },
        natProfile: { type: 'string', enum: ['lan', 'nat', 'webrtc'] },
        department: { type: 'string' },
      },
      entityType: 'endpoint',
      proposes: true,
      handler: async (args, uid) => {
        const existing = await this.endpointsService.findAll(uid);
        const extension = String(args.extension ?? args.username ?? this.nextFreeExtension(existing));
        const context = String(args.context ?? this.defaultContext(existing));
        const displayName = String(args.name ?? args.displayName ?? `Абонент ${extension}`);
        const applyArgs: Record<string, unknown> = {
          extension,
          context,
          displayName,
        };
        if (args.codecs) applyArgs.codecs = args.codecs;
        if (args.natProfile) applyArgs.natProfile = args.natProfile;
        if (args.department) applyArgs.department = args.department;

        return this.proposal(
          'create_endpoint',
          displayName,
          applyArgs,
          null,
          { extension, context, displayName },
          [
            `Создать абонента ${extension} в контексте ${context}`,
            CREDENTIALS_NOTE,
          ],
        );
      },
    };
  }

  private nextFreeExtension(existing: Array<{ extension?: string }>): string {
    let max = DEFAULT_EXTENSION_START - 1;
    for (const row of existing) {
      const numeric = parseInt(String(row.extension ?? ''), 10);
      if (!Number.isNaN(numeric) && numeric > max) max = numeric;
    }
    return String(max + 1);
  }

  private defaultContext(existing: Array<{ context?: string }>): string {
    const fromTenant = existing.find((row) => row.context)?.context;
    return fromTenant || 'from-internal';
  }

  private proposal(
    tool: string,
    label: string,
    args: Record<string, unknown>,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    summary: string[],
  ): AgentDiffProposal {
    return {
      entityType: 'endpoint',
      entityLabel: label,
      summary,
      before,
      after,
      applyPayload: { tool, args },
      includesDialplanReload: false,
    };
  }
}
