import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { IDirectory, IDirectoryRecord } from '@krasterisk/shared';
import { DirectoriesService } from './directories.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
  AgentDiffProposal,
} from '../ai-platform/ai-adapter.types';
import type { DirectoryRecordDto } from './dto/directory.dto';

/**
 * DirectoriesAiAdapter — Domain AI Adapter for universal dialplan directories.
 *
 * Seven tools, registered through AiAdapterRegistryService and consumed by
 * both MCP discovery and generic webhook dispatch. Every handler receives
 * `vpbxUserUid` as a call parameter — never closed over.
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
    return {
      name: 'create_directory',
      description:
        'Создаёт справочник. Нужны name, lookupFieldKey, key_normalization, fields. records опциональны.',
      inputSchema: {
        name: { type: 'string', description: 'Название справочника' },
        description: { type: 'string' },
        lookupFieldKey: { type: 'string', description: 'Ключ поля поиска' },
        key_normalization: { type: 'string', description: 'none | digits' },
        fields: { type: 'array', description: '[{key, label, type, required, position}]' },
        records: { type: 'array', description: '[{match_kind, priority, values, comment?}]' },
      },
      entityType: 'directory',
      proposes: true,
      handler: async (args) => {
        return this.proposal('create_directory', args.name ?? 'directory', args, null, {
          name: args.name,
          lookupFieldKey: args.lookupFieldKey,
        }, [`Создать справочник «${args.name}»`]);
      },
    };
  }

  private toolUpdateDirectory(): AiToolDefinition {
    return {
      name: 'update_directory',
      description:
        'Изменяет справочник. records полностью заменяет текущий список. Для добавления записей используй add_directory_records.',
      inputSchema: {
        uid: { type: 'number', description: 'UID справочника' },
        name: { type: 'string' },
        description: { type: 'string' },
        lookupFieldKey: { type: 'string' },
        key_normalization: { type: 'string' },
        fields: { type: 'array' },
        records: { type: 'array' },
      },
      entityType: 'directory',
      proposes: true,
      handler: async (args, uid) => {
        const directoryUid = Number(args.uid);
        const current = await this.directoriesService.findOne(directoryUid, uid);
        const { uid: _ignored, ...rest } = args;
        return this.proposal(
          'update_directory',
          current.name,
          args,
          this.summary(current),
          { ...this.summary(current), ...rest },
          [`Изменить справочник «${current.name}»`],
        );
      },
    };
  }

  private toolDeleteDirectory(): AiToolDefinition {
    return {
      name: 'delete_directory',
      description:
        'Удаляет справочник, если на него нет ссылок в маршрутах и действиях. Деструктивная операция.',
      inputSchema: { uid: { type: 'number', description: 'UID справочника' } },
      entityType: 'directory',
      destructive: true,
      proposes: true,
      handler: async (args, uid) => {
        const directoryUid = Number(args.uid);
        const current = await this.directoriesService.findOne(directoryUid, uid);
        return this.proposal(
          'delete_directory',
          current.name,
          args,
          this.summary(current),
          null,
          [`Удалить справочник «${current.name}»`],
        );
      },
    };
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
    return {
      name: 'add_directory_records',
      description: 'Добавляет записи инкрементально. Существующие записи сохраняются.',
      inputSchema: {
        uid: { type: 'number', description: 'UID справочника' },
        records: { type: 'array', description: '[{match_kind, priority, values, comment?}]' },
      },
      entityType: 'directory',
      proposes: true,
      handler: async (args, uid) => {
        const directoryUid = Number(args.uid);
        const incoming = (args.records ?? []) as DirectoryRecordDto[];
        const current = await this.directoriesService.findOne(directoryUid, uid);
        const merged = [...this.toRecordDtos(current.records ?? []), ...incoming];
        return this.proposal(
          'add_directory_records',
          current.name,
          args,
          { recordsCount: (current.records ?? []).length },
          { recordsCount: merged.length },
          [`Добавить ${incoming.length} записей в «${current.name}»`],
        );
      },
    };
  }

  private toolRemoveDirectoryRecords(): AiToolDefinition {
    return {
      name: 'remove_directory_records',
      description:
        'Удаляет записи по lookup_values или record_uids. Деструктивная операция.',
      inputSchema: {
        uid: { type: 'number', description: 'UID справочника' },
        lookup_values: { type: 'array', description: 'Значения ключа поиска для удаления' },
        record_uids: { type: 'array', description: 'UID записей для удаления' },
      },
      entityType: 'directory',
      destructive: true,
      proposes: true,
      handler: async (args, uid) => {
        const directoryUid = Number(args.uid);
        const lookupValues = new Set((args.lookup_values ?? []).map((value: unknown) => String(value)));
        const recordUids = new Set((args.record_uids ?? []).map((value: unknown) => Number(value)));
        const current = await this.directoriesService.findOne(directoryUid, uid);
        const remaining = (current.records ?? []).filter((record) => {
          if (recordUids.has(record.uid)) return false;
          if (lookupValues.has(String(record.lookup_value))) return false;
          return true;
        });
        return this.proposal(
          'remove_directory_records',
          current.name,
          args,
          { recordsCount: (current.records ?? []).length },
          { recordsCount: remaining.length },
          [`Удалить записи из «${current.name}»`],
        );
      },
    };
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
