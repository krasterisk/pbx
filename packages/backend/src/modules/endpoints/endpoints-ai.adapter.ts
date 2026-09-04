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
/** Documented AI bulk ceiling — refused at tool time (T-15-38). */
export const BULK_CREATE_CEILING = 50;
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
    return [this.toolCreateEndpoint(), this.toolCreateEndpointsBulk(), this.toolDeleteEndpoint()];
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

  private toolCreateEndpointsBulk(): AiToolDefinition {
    return {
      name: 'create_endpoints_bulk',
      description:
        `Предлагает создать пачку SIP-абонентов по паттерну или count+startExtension. Один proposal на всю пачку. Потолок ${BULK_CREATE_CEILING}.`,
      inputSchema: {
        extensionsPattern: { type: 'string', description: 'Паттерн: "200-220" или "201,205,210-215"' },
        startExtension: { type: 'string', description: 'Стартовый номер, если задан count' },
        count: { type: 'number', description: `Сколько абонентов создать от startExtension. Максимум ${BULK_CREATE_CEILING}.` },
        context: { type: 'string' },
        displayNamePattern: { type: 'string', description: 'Шаблон имени: "Абонент {N}"' },
        codecs: { type: 'string' },
        natProfile: { type: 'string', enum: ['lan', 'nat', 'webrtc'] },
      },
      entityType: 'endpoint',
      proposes: true,
      handler: async (args, uid) => {
        const existing = await this.endpointsService.findAll(uid);
        const context = String(args.context ?? this.defaultContext(existing));
        const pattern = this.bulkPatternFrom(args);
        const extensions = parseBulkExtensions(pattern);
        if (extensions.length > BULK_CREATE_CEILING) {
          return {
            refused: true,
            ceiling: BULK_CREATE_CEILING,
            message: `Пакет больше ${BULK_CREATE_CEILING} абонентов. Потолок: ${BULK_CREATE_CEILING}.`,
          };
        }
        if (extensions.length === 0) {
          return { refused: true, message: 'Пустой или некорректный паттерн абонентов.' };
        }

        const namePattern = String(args.displayNamePattern ?? 'Абонент {N}');
        const perItem = extensions.map((extension) => {
          const displayName = namePattern.replace(/\{N\}/g, extension);
          return `${extension} — ${displayName}`;
        });
        const applyArgs: Record<string, unknown> = {
          extensionsPattern: pattern,
          context,
          passwordPattern: 'auto',
          displayNamePattern: namePattern,
        };
        if (args.codecs) applyArgs.codecs = args.codecs;
        if (args.natProfile) applyArgs.natProfile = args.natProfile;

        return this.proposal(
          'create_endpoints_bulk',
          `${extensions.length} абонентов`,
          applyArgs,
          null,
          { total: extensions.length, extensions, context },
          [
            `Создать ${extensions.length} абонентов (всего ${extensions.length}) в контексте ${context}`,
            ...perItem,
            CREDENTIALS_NOTE,
          ],
        );
      },
    };
  }

  private toolDeleteEndpoint(): AiToolDefinition {
    return {
      name: 'delete_endpoint',
      description: 'Предлагает удалить SIP-абонента по SIP-ID. Деструктивная операция, только внутри тенанта.',
      inputSchema: {
        sipId: { type: 'string', description: 'SIP ID абонента (e{extension}_{tenantId})' },
      },
      entityType: 'endpoint',
      destructive: true,
      proposes: true,
      handler: async (args, uid) => {
        const sipId = String(args.sipId);
        const current = await this.endpointsService.findOne(sipId, uid);
        const extension = String(current.extension ?? sipId);
        const displayName = displayNameFrom(current) || extension;
        return this.proposal(
          'delete_endpoint',
          displayName,
          { sipId },
          { extension, displayName, sipId },
          null,
          [`Удалить абонента ${extension} (${displayName})`],
        );
      },
    };
  }

  private bulkPatternFrom(args: Record<string, unknown>): string {
    if (args.extensionsPattern) return String(args.extensionsPattern);
    const start = parseInt(String(args.startExtension ?? ''), 10);
    const count = Number(args.count);
    if (!Number.isNaN(start) && Number.isFinite(count) && count > 0) {
      const end = start + Math.trunc(count) - 1;
      return `${start}-${end}`;
    }
    return '';
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

export function parseBulkExtensions(pattern: string): string[] {
  const parsed = new Set<number>();
  const parts = (pattern || '').split(',').map((part) => part.trim());
  for (const part of parts) {
    if (!part) continue;
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
        for (let i = start; i <= end; i += 1) parsed.add(i);
      }
    } else {
      const num = parseInt(part, 10);
      if (!Number.isNaN(num)) parsed.add(num);
    }
  }
  return Array.from(parsed)
    .sort((a, b) => a - b)
    .map(String);
}

function displayNameFrom(current: {
  extension?: string;
  endpoint?: { callerid?: string };
  callerid?: string;
}): string {
  const callerid = current.endpoint?.callerid ?? current.callerid ?? '';
  const quoted = callerid.match(/"([^"]+)"/);
  if (quoted?.[1]) return quoted[1];
  return String(current.extension ?? '');
}
