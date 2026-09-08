import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import type { IDirectory, IDirectoryRecord } from '@krasterisk/shared';
import { DIRECTORY_KEY_NORMALIZATIONS } from '@krasterisk/shared';
import { DirectoriesService } from './directories.service';
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
  type MutationRevalidation,
} from '../ai-platform/ai-mutation.contract';
import type { DirectoryRecordDto } from './dto/directory.dto';

const SCHEMA_VERSION = 'directories-1';

const keyNormalization = z.enum(DIRECTORY_KEY_NORMALIZATIONS);

const fieldSchema = z.strictObject({
  key: z.string().min(1).describe('Ключ поля, по нему пишутся значения записей'),
  label: z.string().min(1).describe('Отображаемое имя поля'),
  type: z.enum(['string', 'phone', 'number', 'boolean']).default('string'),
  required: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
});

const recordSchema = z.strictObject({
  match_kind: z.enum(['exact', 'asterisk_pattern']).optional(),
  priority: z.number().int().min(0).optional(),
  values: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .describe('Значения по ключам полей справочника'),
  comment: z.string().optional(),
});

const directoryShape = {
  name: z.string().min(1).describe('Название справочника'),
  description: z.string().optional(),
  lookupFieldKey: z.string().min(1).describe('Ключ поля поиска'),
  key_normalization: keyNormalization.optional().describe('none | digits | ru_8_to_7'),
  fields: z.array(fieldSchema).optional().describe('Схема полей справочника'),
  records: z.array(recordSchema).optional(),
};

const createInput = z.strictObject(directoryShape);
const createArgs = z.strictObject({
  ...directoryShape,
  key_normalization: keyNormalization.default('digits'),
  fields: z.array(fieldSchema).default([]),
});

const updateInput = z.strictObject({
  uid: z.number().int().positive().describe('UID справочника'),
  ...directoryShape,
  name: z.string().min(1).optional(),
  lookupFieldKey: z.string().min(1).optional(),
});
const updateArgs = updateInput;

const byUid = z.strictObject({ uid: z.number().int().positive().describe('UID справочника') });

const addRecordsInput = z.strictObject({
  uid: z.number().int().positive().describe('UID справочника'),
  records: z.array(recordSchema).min(1).describe('[{values, match_kind?, priority?, comment?}]'),
});

const removeRecordsInput = z.strictObject({
  uid: z.number().int().positive().describe('UID справочника'),
  lookup_values: z.array(z.string()).optional().describe('Значения ключа поиска для удаления'),
  record_uids: z.array(z.number().int()).optional().describe('UID записей для удаления'),
});

type CreateArgs = z.infer<typeof createArgs>;
type UpdateArgs = z.infer<typeof updateArgs>;
type ByUid = z.infer<typeof byUid>;
type AddRecordsArgs = z.infer<typeof addRecordsInput>;
type RemoveRecordsArgs = z.infer<typeof removeRecordsInput>;

/**
 * DirectoriesAiAdapter — Domain AI Adapter for universal dialplan directories.
 *
 * Seven tools, registered through AiAdapterRegistryService and consumed by
 * both MCP discovery and generic webhook dispatch. Every handler receives
 * `vpbxUserUid` as a call parameter — never closed over.
 *
 * The five mutating tools carry an executable contract: the strict schema the
 * model is shown is the schema their arguments are parsed with, and the write
 * that a confirmation performs lives here rather than in a central switch.
 */
@Injectable()
export class DirectoriesAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(DirectoriesAiAdapter.name);
  readonly domain = 'directories';

  constructor(
    private readonly directoriesService: DirectoriesService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('DirectoriesAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolListDirectories(),
      this.toolCreateDirectory(),
      this.toolUpdateDirectory(),
      this.toolDeleteDirectory(),
      this.toolListDirectoryRecords(),
      this.toolAddDirectoryRecords(),
      this.toolRemoveDirectoryRecords(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Справочники (Directories) — модель данных
- Справочник = схема полей + записи. Поведение задаётся привязкой к маршруту, не самой сущностью.
- Ключ поиска всегда явный (key source): original_caller, current_caller, route_pattern, variable, fixed. CALLERID(num) сам по себе ключом не является.
- Точное совпадение (exact) всегда проверяется раньше паттерна (asterisk_pattern). При нескольких паттернах побеждает меньший priority, затем меньший uid.
- Ссылки на поля идут по числовым field UID, не по display name. В management API записи пишутся ключами полей (field key), runtime lookup читает field_uids.
- Исходы lookup: FOUND, NOT_FOUND, ERROR. Технический ERROR — fail-open: исходный CallerID и значения канала сохраняются, on_no_match не выполняется.
- Один HTTP-запрос возвращает все запрошенные field UID записи. Глобального пространства переменных по ключу записи нет.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const directories = await this.directoriesService.findAll(vpbxUserUid);
    if (directories.length === 0) return '';

    const lines: string[] = ['Справочники (Directories):'];
    for (const directory of directories) {
      const fieldsCount = (directory.fields || []).length;
      const recordsCount = (directory.records || []).length;
      const desc = directory.description ? ` (${directory.description})` : '';
      lines.push(`  • "${directory.name}"${desc}: ${fieldsCount} полей, ${recordsCount} записей`);
    }
    return lines.join('\n');
  }

  private toolListDirectories(): AiToolDefinition {
    return {
      name: 'list_directories',
      description:
        'Список справочников тенанта: uid, имя, описание, поля, число записей. Полные записи — через list_directory_records.',
      inputSchema: {},
      entityType: 'directory',
      handler: async (_args, uid) => {
        const directories = await this.directoriesService.findAll(uid);
        return {
          directories: directories.map((directory) => ({
            uid: directory.uid,
            name: directory.name,
            description: directory.description,
            lookup_field_uid: directory.lookup_field_uid,
            key_normalization: directory.key_normalization,
            fieldsCount: (directory.fields || []).length,
            recordsCount: (directory.records || []).length,
            fields: (directory.fields || []).map((field) => ({
              uid: field.uid,
              key: field.key,
              label: field.label,
              type: field.type,
            })),
          })),
        };
      },
    };
  }

  private toolCreateDirectory(): AiToolDefinition {
    return defineMutationTool<z.infer<typeof createInput>, CreateArgs>({
      name: 'create_directory',
      description:
        'Создаёт справочник. Нужны name, lookupFieldKey, key_normalization, fields. records опциональны.',
      entityType: 'directory',
      schemaVersion: SCHEMA_VERSION,
      input: createInput,
      args: createArgs,
      reload: { kind: 'none' },
      propose: async (input) =>
        this.proposal('create_directory', input.name, input, null, {
          name: input.name,
          lookupFieldKey: input.lookupFieldKey,
        }, [`Создать справочник «${input.name}»`]),
      revalidate: async (args) => ({ ok: true, args }),
      apply: async (args, ctx) => {
        await this.directoriesService.create(args as never, ctx.vpbxUserUid);
      },
    });
  }

  private toolUpdateDirectory(): AiToolDefinition {
    return defineMutationTool<UpdateArgs, UpdateArgs>({
      name: 'update_directory',
      description:
        'Изменяет справочник. records полностью заменяет текущий список. Для добавления записей используй add_directory_records.',
      entityType: 'directory',
      schemaVersion: SCHEMA_VERSION,
      input: updateInput,
      args: updateArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const current = await this.directoriesService.findOne(input.uid, ctx.vpbxUserUid);
        const { uid: _ignored, ...rest } = input;
        return this.proposal(
          'update_directory',
          current.name,
          input,
          this.summary(current),
          { ...this.summary(current), ...rest },
          [`Изменить справочник «${current.name}»`],
        );
      },
      revalidate: (args, ctx) => this.requireDirectory(args, args.uid, ctx),
      apply: async (args, ctx) => {
        const { uid: directoryUid, ...rest } = args;
        await this.directoriesService.update(directoryUid, rest as never, ctx.vpbxUserUid);
      },
    });
  }

  private toolDeleteDirectory(): AiToolDefinition {
    return defineMutationTool<ByUid, ByUid>({
      name: 'delete_directory',
      description:
        'Удаляет справочник, если на него нет ссылок в маршрутах и действиях. Деструктивная операция.',
      entityType: 'directory',
      destructive: true,
      schemaVersion: SCHEMA_VERSION,
      input: byUid,
      args: byUid,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const current = await this.directoriesService.findOne(input.uid, ctx.vpbxUserUid);
        return this.proposal(
          'delete_directory',
          current.name,
          input,
          this.summary(current),
          null,
          [`Удалить справочник «${current.name}»`],
        );
      },
      revalidate: (args, ctx) => this.requireDirectory(args, args.uid, ctx),
      apply: async (args, ctx) => {
        await this.directoriesService.remove(args.uid, ctx.vpbxUserUid);
      },
    });
  }

  private toolListDirectoryRecords(): AiToolDefinition {
    return {
      name: 'list_directory_records',
      description: 'Полные записи справочника (values по ключам полей).',
      inputSchema: { uid: { type: 'number', description: 'UID справочника' } },
      entityType: 'directory',
      handler: async (args, uid) => {
        const directory = await this.directoriesService.findOne(Number(args.uid), uid);
        return { uid: directory.uid, records: directory.records ?? [] };
      },
    };
  }

  private toolAddDirectoryRecords(): AiToolDefinition {
    return defineMutationTool<AddRecordsArgs, AddRecordsArgs>({
      name: 'add_directory_records',
      description: 'Добавляет записи инкрементально. Существующие записи сохраняются.',
      entityType: 'directory',
      schemaVersion: SCHEMA_VERSION,
      input: addRecordsInput,
      args: addRecordsInput,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const current = await this.directoriesService.findOne(input.uid, ctx.vpbxUserUid);
        const merged = [...(current.records ?? []), ...input.records];
        return this.proposal(
          'add_directory_records',
          current.name,
          input,
          { recordsCount: (current.records ?? []).length },
          { recordsCount: merged.length },
          [`Добавить ${input.records.length} записей в «${current.name}»`],
        );
      },
      revalidate: (args, ctx) => this.requireDirectory(args, args.uid, ctx),
      apply: async (args, ctx) => {
        // Merge against the list as it stands now, not as it stood when the card
        // was built, so a record added meanwhile is not silently dropped.
        const current = await this.directoriesService.findOne(args.uid, ctx.vpbxUserUid);
        const merged = [...this.toRecordDtos(current.records ?? []), ...(args.records as DirectoryRecordDto[])];
        await this.directoriesService.update(args.uid, { records: merged } as never, ctx.vpbxUserUid);
      },
    });
  }

  private toolRemoveDirectoryRecords(): AiToolDefinition {
    return defineMutationTool<RemoveRecordsArgs, RemoveRecordsArgs>({
      name: 'remove_directory_records',
      description:
        'Удаляет записи по lookup_values или record_uids. Деструктивная операция.',
      entityType: 'directory',
      destructive: true,
      schemaVersion: SCHEMA_VERSION,
      input: removeRecordsInput,
      args: removeRecordsInput,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const current = await this.directoriesService.findOne(input.uid, ctx.vpbxUserUid);
        const remaining = this.keepRecords(current.records ?? [], input);
        return this.proposal(
          'remove_directory_records',
          current.name,
          input,
          { recordsCount: (current.records ?? []).length },
          { recordsCount: remaining.length },
          [`Удалить записи из «${current.name}»`],
        );
      },
      revalidate: (args, ctx) => this.requireDirectory(args, args.uid, ctx),
      apply: async (args, ctx) => {
        const current = await this.directoriesService.findOne(args.uid, ctx.vpbxUserUid);
        const remaining = this.keepRecords(current.records ?? [], args);
        await this.directoriesService.update(
          args.uid,
          { records: this.toRecordDtos(remaining) } as never,
          ctx.vpbxUserUid,
        );
      },
    });
  }

  private keepRecords(records: IDirectoryRecord[], args: RemoveRecordsArgs): IDirectoryRecord[] {
    const lookupValues = new Set((args.lookup_values ?? []).map(String));
    const recordUids = new Set((args.record_uids ?? []).map(Number));
    return records.filter((record) => {
      if (recordUids.has(record.uid)) return false;
      if (lookupValues.has(String(record.lookup_value))) return false;
      return true;
    });
  }

  /** Confirm-time check: the directory the card names still belongs to this tenant. */
  private async requireDirectory<T>(
    args: T,
    directoryUid: number,
    ctx: AiMutationContext,
  ): Promise<MutationRevalidation<T>> {
    try {
      await this.directoriesService.findOne(directoryUid, ctx.vpbxUserUid);
      return { ok: true, args };
    } catch {
      return { ok: false, reason: `Справочник ${directoryUid} не найден у тенанта` };
    }
  }

  private toRecordDtos(records: IDirectoryRecord[]): DirectoryRecordDto[] {
    return records.map((record) => ({
      match_kind: record.match_kind,
      priority: record.priority,
      values: (record.values ?? {}) as Record<string, string | number | boolean>,
      comment: record.comment,
    }));
  }

  private summary(directory: IDirectory) {
    return {
      uid: directory.uid,
      name: directory.name,
      fieldsCount: (directory.fields || []).length,
      recordsCount: (directory.records || []).length,
    };
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
      entityType: 'directory',
      entityLabel: label,
      summary,
      before,
      after,
      applyPayload: { tool, args },
      includesDialplanReload: false,
    };
  }
}
