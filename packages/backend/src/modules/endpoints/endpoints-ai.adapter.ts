import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { toPublicExten } from '../../shared/utils/tenant-public-id.util';
import { buildSipId } from './endpoint-ids.util';
import { EndpointsService } from './endpoints.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
  AgentDiffProposal,
} from '../ai-platform/ai-adapter.types';
import {
  defineMutationTool,
  type AiMutationContext,
  type AiToolRefusal,
  type MutationRevalidation,
} from '../ai-platform/ai-mutation.contract';

const DEFAULT_EXTENSION_START = 200;
/** Documented AI bulk ceiling — refused at tool time (T-15-38). */
export const BULK_CREATE_CEILING = 50;
const CREDENTIALS_NOTE =
  'Учётные данные доступны на экране абонента — пароль в переписку не попадает.';
const SCHEMA_VERSION = 'endpoints-1';

const natProfile = z.enum(['lan', 'nat', 'webrtc']);

const createInput = z.strictObject({
  extension: z.string().optional().describe('Номер абонента. Если не указан — следующий свободный у тенанта.'),
  name: z.string().optional().describe('Отображаемое имя'),
  displayName: z.string().optional().describe('Псевдоним для name'),
  context: z.string().optional().describe('Контекст маршрутизации. Если не указан — контекст существующих абонентов.'),
  codecs: z.string().optional(),
  natProfile: natProfile.optional(),
  department: z.string().optional(),
});

const createArgs = z.strictObject({
  extension: z.string().min(1),
  context: z.string().min(1),
  displayName: z.string().min(1),
  codecs: z.string().optional(),
  natProfile: natProfile.optional(),
  department: z.string().optional(),
});

const bulkInput = z.strictObject({
  extensionsPattern: z.string().optional().describe('Паттерн: "200-220" или "201,205,210-215"'),
  startExtension: z.string().optional().describe('Стартовый номер, если задан count'),
  count: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(`Сколько абонентов создать от startExtension. Максимум ${BULK_CREATE_CEILING}.`),
  context: z.string().optional(),
  displayNamePattern: z.string().optional().describe('Шаблон имени: "Абонент {N}"'),
  codecs: z.string().optional(),
  natProfile: natProfile.optional(),
});

const bulkArgs = z.strictObject({
  extensionsPattern: z.string().min(1),
  context: z.string().min(1),
  passwordPattern: z.literal('auto'),
  displayNamePattern: z.string().min(1),
  codecs: z.string().optional(),
  natProfile: natProfile.optional(),
});

const deleteInput = z.strictObject({
  sipId: z.string().min(1).describe('Внутренний номер абонента, 2–8 цифр'),
});
const deleteArgs = deleteInput;

type CreateInput = z.infer<typeof createInput>;
type CreateArgs = z.infer<typeof createArgs>;
type BulkInput = z.infer<typeof bulkInput>;
type BulkArgs = z.infer<typeof bulkArgs>;
type DeleteArgs = z.infer<typeof deleteArgs>;

/**
 * EndpointsAiAdapter — subscriber (SIP endpoint) mutations as proposals (D-18).
 * Credential generation lives in EndpointsService, never in this layer, and no
 * schema here accepts a password: a secret the model invented must not survive
 * into a confirmation card.
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
    return [
      this.toolListEndpoints(),
      this.toolCreateEndpoint(),
      this.toolCreateEndpointsBulk(),
      this.toolDeleteEndpoint(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Абоненты (Endpoints)
- Сначала list_endpoints с фильтром названных номеров (101-103). Не выгружай весь список. Не утверждай, что номера нет, по sample снимка. create_endpoints_bulk сам пропустит уже существующие.
- В инструментах только публичный номер (101), не SIP id.
- Пароль на экране абонента, не в чате.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const endpoints = await this.endpointsService.findAll(vpbxUserUid);
    if (endpoints.length === 0) return '';
    return `Абоненты: ${endpoints.length}`;
  }

  private toolListEndpoints(): AiToolDefinition {
    return {
      name: 'list_endpoints',
      description:
        'Точечная проверка абонентов: всегда передавай extensions ("101-103" или "101,102"). '
        + 'Без фильтра вернётся только счётчик и короткий образец, не весь список. Без SIP id и без изменений.',
      inputSchema: {
        extensions: { type: 'string', description: 'Обязателен, если номера названы: "101-103" или "101,102"' },
      },
      entityType: 'endpoint',
      handler: async (args, uid) => {
        const rows = await this.endpointsService.findAll(uid);
        const mapped = rows.map((row) => ({
          extension: toPublicExten(row.extension ?? '', uid),
          name: displayNameFrom(row) || toPublicExten(row.extension ?? '', uid),
          context: row.context ?? null,
        }));
        const wanted = args.extensions
          ? parseBulkExtensions(String(args.extensions))
          : null;
        if (wanted) {
          const found = new Set(mapped.map((row) => row.extension));
          return {
            endpoints: mapped.filter((row) => wanted.includes(row.extension)),
            missing: wanted.filter((extension) => !found.has(extension)),
          };
        }
        const limit = 15;
        return {
          total: mapped.length,
          endpoints: mapped.slice(0, limit),
          truncated: mapped.length > limit,
        };
      },
    };
  }

  private toolCreateEndpoint(): AiToolDefinition {
    return defineMutationTool<CreateInput, CreateArgs>({
      name: 'create_endpoint',
      description:
        'Предлагает создать одного SIP-абонента. Номер и контекст по умолчанию берутся из абонентов тенанта. Пароль не возвращается.',
      entityType: 'endpoint',
      schemaVersion: SCHEMA_VERSION,
      input: createInput,
      args: createArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const existing = await this.endpointsService.findAll(ctx.vpbxUserUid);
        const extension = toPublicExten(
          input.extension ?? this.nextFreeExtension(existing),
          ctx.vpbxUserUid,
        );
        const context = input.context ?? this.defaultContext(existing);
        const displayName = input.name ?? input.displayName ?? `Абонент ${extension}`;
        const applyArgs: CreateArgs = { extension, context, displayName };
        if (input.codecs) applyArgs.codecs = input.codecs;
        if (input.natProfile) applyArgs.natProfile = input.natProfile;
        if (input.department) applyArgs.department = input.department;

        return this.proposal(
          'create_endpoint',
          displayName,
          applyArgs,
          null,
          { extension, context, displayName },
          [`Создать абонента ${extension} в контексте ${context}`, CREDENTIALS_NOTE],
        );
      },
      revalidate: async (args, ctx) => {
        const taken = await this.takenExtensions(ctx);
        if (taken.has(args.extension)) {
          return { ok: false, reason: `Номер ${args.extension} уже занят у тенанта` };
        }
        return { ok: true, args };
      },
      apply: async (args, ctx) => {
        await this.endpointsService.createWithGeneratedCredentials(args as never, ctx.vpbxUserUid);
      },
    });
  }

  private toolCreateEndpointsBulk(): AiToolDefinition {
    return defineMutationTool<BulkInput, BulkArgs>({
      name: 'create_endpoints_bulk',
      description:
        `Предлагает создать пачку SIP-абонентов по паттерну или count+startExtension. Один proposal на всю пачку. Потолок ${BULK_CREATE_CEILING}.`,
      entityType: 'endpoint',
      schemaVersion: SCHEMA_VERSION,
      input: bulkInput,
      args: bulkArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const existing = await this.endpointsService.findAll(ctx.vpbxUserUid);
        const context = input.context ?? this.defaultContext(existing);
        const pattern = this.bulkPatternFrom(input);
        const extensions = parseBulkExtensions(pattern);
        const refused = this.refuseBadBatch(extensions);
        if (refused) return refused;

        const taken = await this.takenExtensions(ctx);
        const missing = extensions.filter((extension) => !taken.has(extension));
        if (missing.length === 0) {
          return {
            skipped: true,
            message: `Абоненты ${extensions.join(', ')} уже есть — создавать не нужно.`,
            already: extensions,
          };
        }

        const namePattern = input.displayNamePattern ?? 'Абонент {N}';
        const perItem = missing.map((extension) => `${extension} — ${namePattern.replace(/\{N\}/g, extension)}`);
        const applyArgs: BulkArgs = {
          extensionsPattern: toExtensionsPattern(missing),
          context,
          passwordPattern: 'auto',
          displayNamePattern: namePattern,
        };
        if (input.codecs) applyArgs.codecs = input.codecs;
        if (input.natProfile) applyArgs.natProfile = input.natProfile;

        const already = extensions.filter((extension) => taken.has(extension));
        const summary = [
          `Создать ${missing.length} абонентов в контексте ${context}`,
          ...perItem,
        ];
        if (already.length) {
          summary.push(`Уже есть, пропускаю: ${already.join(', ')}`);
        }
        summary.push(CREDENTIALS_NOTE);

        return this.proposal(
          'create_endpoints_bulk',
          missing.join(', '),
          applyArgs,
          null,
          { total: missing.length, extensions: missing, context, already },
          summary,
        );
      },
      revalidate: async (args, ctx) => {
        const extensions = parseBulkExtensions(args.extensionsPattern);
        if (this.refuseBadBatch(extensions)) {
          return { ok: false, reason: `Пакет вне допустимого размера (потолок ${BULK_CREATE_CEILING})` };
        }
        const taken = await this.takenExtensions(ctx);
        const collisions = extensions.filter((extension) => taken.has(extension));
        if (collisions.length) {
          return { ok: false, reason: `Номера уже заняты у тенанта: ${collisions.join(', ')}` };
        }
        return { ok: true, args };
      },
      apply: async (args, ctx) => {
        await this.endpointsService.bulkCreate(args as never, ctx.vpbxUserUid);
      },
    });
  }

  private toolDeleteEndpoint(): AiToolDefinition {
    return defineMutationTool<DeleteArgs, DeleteArgs>({
      name: 'delete_endpoint',
      description: 'Предлагает удалить SIP-абонента по внутреннему номеру. Деструктивная операция, только внутри тенанта.',
      entityType: 'endpoint',
      destructive: true,
      schemaVersion: SCHEMA_VERSION,
      input: deleteInput,
      args: deleteArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const sipId = await this.resolveSipId(input.sipId, ctx.vpbxUserUid);
        const current = await this.endpointsService.findOne(sipId, ctx.vpbxUserUid);
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
      revalidate: async (args, ctx) => {
        try {
          await this.endpointsService.findOne(args.sipId, ctx.vpbxUserUid);
          return { ok: true, args };
        } catch {
          return { ok: false, reason: `Абонент ${args.sipId} не найден у тенанта` };
        }
      },
      apply: async (args, ctx) => {
        await this.endpointsService.remove(args.sipId, ctx.vpbxUserUid);
      },
    });
  }

  private refuseBadBatch(extensions: string[]): AiToolRefusal | null {
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
    return null;
  }

  private async takenExtensions(ctx: AiMutationContext): Promise<Set<string>> {
    const existing = await this.endpointsService.findAll(ctx.vpbxUserUid);
    return new Set(existing.map((row) => toPublicExten(row.extension ?? '', ctx.vpbxUserUid)));
  }

  private async resolveSipId(raw: string, uid: number): Promise<string> {
    const value = raw.trim();
    if (/^ew?.+_\d+$/i.test(value)) return value;
    const publicExt = toPublicExten(value, uid);
    const existing = await this.endpointsService.findAll(uid);
    const match = existing.find((row) => String(row.extension) === publicExt);
    if (match?.sipUsername) return String(match.sipUsername);
    return buildSipId(uid, publicExt || value);
  }

  private bulkPatternFrom(input: BulkInput): string {
    if (input.extensionsPattern) return input.extensionsPattern;
    const start = parseInt(String(input.startExtension ?? ''), 10);
    const count = input.count;
    if (!Number.isNaN(start) && count != null) {
      return `${start}-${start + count - 1}`;
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

export function toExtensionsPattern(extensions: string[]): string {
  const nums = [...new Set(extensions.map((value) => parseInt(value, 10)).filter((n) => !Number.isNaN(n)))]
    .sort((a, b) => a - b);
  if (nums.length === 0) return '';
  const parts: string[] = [];
  let start = nums[0];
  let prev = nums[0];
  for (let i = 1; i <= nums.length; i += 1) {
    const current = nums[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}-${prev}`);
    start = current;
    prev = current;
  }
  return parts.join(',');
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
