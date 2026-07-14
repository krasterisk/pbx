import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { ICreatePhonebookDto } from '@krasterisk/shared';
import { PhonebooksService } from './phonebooks.service';
import { RoutesService } from '../routes/routes.service';
import { RouteApplyService } from '../routes/route-apply.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import { AiToolDefinition, AiStateProvider, DomainAiAdapter } from '../ai-platform/ai-adapter.types';
import { RoutePhonebookBinding } from './route-phonebook-binding.model';
import { Route } from '../routes/route.model';

/**
 * PhonebooksAiAdapter — reference implementation of the Domain AI Adapter
 * contract (D-14/D-15): 7 atomic phonebook tools + `update_route` with
 * bindings, a compact per-tenant State summary, and a static Knowledge block.
 *
 * All handlers receive `vpbxUserUid` as a call parameter (D-23) — never
 * closed over — and delegate to PhonebooksService/RoutesService/
 * RouteApplyService which already enforce tenant ownership via `user_uid`
 * on every query.
 */
@Injectable()
export class PhonebooksAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(PhonebooksAiAdapter.name);
  readonly domain = 'phonebooks';

  constructor(
    private readonly phonebooksService: PhonebooksService,
    private readonly routesService: RoutesService,
    private readonly routeApplyService: RouteApplyService,
    private readonly dialplanApplyService: DialplanApplyService,
    private readonly registry: AiAdapterRegistryService,
    @InjectModel(RoutePhonebookBinding) private readonly bindingModel: typeof RoutePhonebookBinding,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolListPhonebooks(),
      this.toolCreatePhonebook(),
      this.toolUpdatePhonebook(),
      this.toolDeletePhonebook(),
      this.toolAddPhonebookEntries(),
      this.toolRemovePhonebookEntries(),
      this.toolListPhonebookEntries(),
      this.toolUpdateRoute(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  /** Static KB block, 10-15 lines (D-16): data+binding model, 7 presets, ordering rule, match_mode semantics. */
  getKnowledgeBlock(): string {
    return `## Справочники (Phonebooks) — модель данных
- Справочник = чистые данные: name, description, entries [{number, comment, vars}]. Поведение НЕ хранится в справочнике.
- Привязка (binding) на маршруте определяет поведение: phonebook_uid + position + match_mode + behavior_type
- match_mode: on_match (номер найден в справочнике) | on_no_match (номер НЕ найден)
- 7 пресетов behavior_type:
  • set_name — установить CallerID(name) из var
  • set_number — подменить CallerID(num) (fixed или из var)
  • blacklist — сбросить звонок (Hangup), обычно match_mode=on_match
  • whitelist — сбросить звонок если НЕ найден (match_mode=on_no_match)
  • redirect — переадресовать на другой extension (fixed или из var)
  • custom — произвольные dialplan-actions
  • vars_only — только установить PB_<key> переменные, без побочных эффектов
- Один справочник можно привязать к нескольким маршрутам с разной политикой
- Порядок биндингов ВАЖЕН (position ASC): blacklist должен идти РАНЬШЕ VIP-приветствия
- Полные записи справочника — только через list_phonebook_entries (list_phonebooks даёт лишь сводку)`;
  }

  // ─── State (D-16) ───────────────────────────────────────────────────────────

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const phonebooks = await this.phonebooksService.findAll(vpbxUserUid);
    if (phonebooks.length === 0) return '';

    const lines: string[] = ['Справочники (Phonebooks):'];
    for (const pb of phonebooks) {
      const bindings = await this.getBindingsWithRoute(pb.uid, vpbxUserUid);
      const entriesCount = (pb.entries || []).length;
      const bindingsStr = bindings.length
        ? bindings.map((b) => `"${(b as any).route?.name ?? `route_${b.route_uid}`}" (${b.behavior_type}, ${b.match_mode})`).join('; ')
        : 'без привязок';
      lines.push(`  • "${pb.name}"${pb.description ? ` — ${pb.description}` : ''}: ${entriesCount} записей, привязки: ${bindingsStr}`);
    }
    return lines.join('\n');
  }

  private async getBindingsWithRoute(phonebookUid: number, vpbxUserUid: number): Promise<RoutePhonebookBinding[]> {
    return this.bindingModel.findAll({
      where: { phonebook_uid: phonebookUid, user_uid: vpbxUserUid },
      include: [{ model: Route, as: 'route', attributes: ['uid', 'name'] }],
      order: [['position', 'ASC']],
    });
  }

  // ─── Tools ────────────────────────────────────────────────────────────────

  private toolListPhonebooks(): AiToolDefinition {
    return {
      name: 'list_phonebooks',
      description: 'Возвращает список справочников тенанта: uid, имя, описание, кол-во записей, привязки к маршрутам. Полные записи — через list_phonebook_entries.',
      inputSchema: {},
      entityType: 'phonebook',
      handler: async (_args, uid) => {
        const phonebooks = await this.phonebooksService.findAll(uid);
        const results = [];
        for (const pb of phonebooks) {
          const bindings = await this.getBindingsWithRoute(pb.uid, uid);
          results.push({
            uid: pb.uid,
            name: pb.name,
            description: pb.description,
            entriesCount: (pb.entries || []).length,
            bindings: bindings.map((b) => ({
              route: (b as any).route?.name ?? `route_${b.route_uid}`,
              match_mode: b.match_mode,
              behavior_type: b.behavior_type,
            })),
          });
        }
        return { phonebooks: results };
      },
    };
  }

  private toolCreatePhonebook(): AiToolDefinition {
    return {
      name: 'create_phonebook',
      description: 'Создаёт справочник (чистые данные для последующей привязки к маршруту). entries: [{number, comment?, vars?: {key: value}}].',
      inputSchema: {
        name: { type: 'string', description: 'Название справочника' },
        description: { type: 'string' },
        entries: { type: 'array', description: '[{number, comment?, vars?: {key: value}}]' },
      },
      entityType: 'phonebook',
      handler: async (args, uid) => {
        const pb = await this.phonebooksService.create(args as ICreatePhonebookDto, uid);
        return { uid: pb.uid, name: pb.name, entriesCount: (pb.entries || []).length };
      },
    };
  }

  private toolUpdatePhonebook(): AiToolDefinition {
    return {
      name: 'update_phonebook',
      description: 'Изменяет справочник. entries полностью заменяет текущий список (replace-all) — для инкрементального добавления используй add_phonebook_entries.',
      inputSchema: {
        uid: { type: 'number', description: 'UID справочника' },
        name: { type: 'string' },
        description: { type: 'string' },
        entries: { type: 'array', description: 'Полная замена списка записей: [{number, comment?, vars?}]' },
      },
      entityType: 'phonebook',
      handler: async (args, uid) => {
        const { uid: pbUid, ...rest } = args;
        const before = await this.phonebooksService.findOne(pbUid, uid);
        const beforeKeys = this.phonebooksService.collectAllVarKeys(before.entries || []);
        const pb = await this.phonebooksService.update(pbUid, rest as ICreatePhonebookDto, uid);
        await this.reapplyIfVarKeysChanged(pbUid, uid, beforeKeys, pb);
        return { uid: pb.uid, name: pb.name, entriesCount: (pb.entries || []).length };
      },
    };
  }

  private toolDeletePhonebook(): AiToolDefinition {
    return {
      name: 'delete_phonebook',
      description: 'Удаляет справочник и все его записи. Также удаляет привязки к маршрутам (CASCADE) — затронутые маршруты будут пересобраны.',
      inputSchema: { uid: { type: 'number', description: 'UID справочника' } },
      entityType: 'phonebook',
      destructive: true,
      handler: async (args, uid) => {
        const pbUid = args.uid;
        const affected = await this.routeApplyService.getAffectedContexts(pbUid, uid);
        await this.phonebooksService.remove(pbUid, uid);
        for (const contextUid of affected.contextUids) {
          await this.routeApplyService.applyContext(contextUid, uid, false).catch((e: any) =>
            this.logger.error(`Re-apply context ${contextUid} after delete_phonebook ${pbUid} failed: ${e?.message || e}`));
        }
        if (affected.bindingUids.length > 0) {
          const orphanNames = affected.bindingUids.map((bUid) => `pb_bind_${bUid}_${uid}`);
          await this.dialplanApplyService.deleteCategories(`krasterisk/phonebooks/pb_${uid}.conf`, orphanNames, { reload: true }).catch((e: any) =>
            this.logger.error(`Cleanup orphaned binding categories for phonebook ${pbUid} failed: ${e?.message || e}`));
        }
        return `✅ Справочник ${pbUid} удалён.`;
      },
    };
  }

  private toolAddPhonebookEntries(): AiToolDefinition {
    return {
      name: 'add_phonebook_entries',
      description: 'Добавляет записи в справочник инкрементально — существующие записи сохраняются (в отличие от update_phonebook).',
      inputSchema: {
        uid: { type: 'number', description: 'UID справочника' },
        entries: { type: 'array', description: '[{number, comment?, vars?: {key: value}}]' },
      },
      entityType: 'phonebook',
      handler: async (args, uid) => {
        const pbUid = args.uid;
        const newEntries: Array<{ number: string; comment?: string; vars?: Record<string, string> }> = args.entries || [];
        const before = await this.phonebooksService.findOne(pbUid, uid);
        const beforeKeys = this.phonebooksService.collectAllVarKeys(before.entries || []);
        const existing = (before.entries || []).map((e) => ({ number: e.number, comment: e.comment, vars: e.vars || undefined }));
        const merged = [...existing, ...newEntries];
        const pb = await this.phonebooksService.update(
          pbUid,
          { name: before.name, description: before.description, entries: merged } as ICreatePhonebookDto,
          uid,
        );
        await this.reapplyIfVarKeysChanged(pbUid, uid, beforeKeys, pb);
        return { uid: pb.uid, entriesCount: (pb.entries || []).length, added: newEntries.length };
      },
    };
  }

  private toolRemovePhonebookEntries(): AiToolDefinition {
    return {
      name: 'remove_phonebook_entries',
      description: 'Удаляет записи из справочника по номерам.',
      inputSchema: {
        uid: { type: 'number', description: 'UID справочника' },
        numbers: { type: 'array', description: 'Список номеров для удаления' },
      },
      entityType: 'phonebook',
      destructive: true,
      handler: async (args, uid) => {
        const pbUid = args.uid;
        const numbers: string[] = args.numbers || [];
        const before = await this.phonebooksService.findOne(pbUid, uid);
        const beforeKeys = this.phonebooksService.collectAllVarKeys(before.entries || []);
        const beforeCount = (before.entries || []).length;
        const remaining = (before.entries || [])
          .filter((e) => !numbers.includes(e.number))
          .map((e) => ({ number: e.number, comment: e.comment, vars: e.vars || undefined }));
        const pb = await this.phonebooksService.update(
          pbUid,
          { name: before.name, description: before.description, entries: remaining } as ICreatePhonebookDto,
          uid,
        );
        await this.reapplyIfVarKeysChanged(pbUid, uid, beforeKeys, pb);
        return `✅ Удалено ${beforeCount - remaining.length} записей из справочника ${pbUid}.`;
      },
    };
  }

  private toolListPhonebookEntries(): AiToolDefinition {
    return {
      name: 'list_phonebook_entries',
      description: 'Возвращает записи справочника (по умолчанию до 50, максимум 200). Используй для деталей — list_phonebooks/summary не содержат полных записей (D-16).',
      inputSchema: {
        uid: { type: 'number', description: 'UID справочника' },
        limit: { type: 'number', description: 'Максимум записей (default 50, max 200)' },
        search: { type: 'string', description: 'Поиск по номеру или комментарию' },
      },
      entityType: 'phonebook',
      handler: async (args, uid) => {
        const pb = await this.phonebooksService.findOne(args.uid, uid);
        let entries = pb.entries || [];
        if (args.search) {
          const s = String(args.search).toLowerCase();
          entries = entries.filter((e) => e.number.toLowerCase().includes(s) || (e.comment || '').toLowerCase().includes(s));
        }
        const limit = Math.min(args.limit || 50, 200);
        const sliced = entries.slice(0, limit);
        return {
          total: entries.length,
          entries: sliced.map((e) => ({ number: e.number, comment: e.comment, vars: e.vars })),
        };
      },
    };
  }

  private toolUpdateRoute(): AiToolDefinition {
    return {
      name: 'update_route',
      description: 'Изменяет маршрут (name, extensions, actions, options, active, bindings к справочникам). bindings полностью заменяет текущие привязки и может удалить/переадресовать вызовы — деструктивная операция. bindings: [{phonebook_uid, position, match_mode: on_match|on_no_match, behavior_type: set_name|set_number|blacklist|whitelist|redirect|custom|vars_only, behavior_params?, actions?}].',
      inputSchema: {
        uid: { type: 'number', description: 'UID маршрута' },
        name: { type: 'string' },
        extensions: { type: 'array', description: 'Список номеров/паттернов' },
        actions: { type: 'array' },
        options: { type: 'object' },
        active: { type: 'number' },
        bindings: { type: 'array', description: '[{phonebook_uid, position, match_mode, behavior_type, behavior_params?, actions?}] — полная замена привязок' },
      },
      entityType: 'route',
      destructive: true,
      handler: async (args, uid) => {
        const { uid: routeUid, confirm: _confirm, ...rest } = args;
        const oldRoute = await this.routesService.findOne(routeUid, uid);
        const oldContextUid = oldRoute.context_uid;

        const route = await this.routesService.update(routeUid, rest as any, uid);

        await this.routeApplyService.applyContext(route.context_uid, uid, false).catch((e: any) =>
          this.logger.error(`Apply context ${route.context_uid} after update_route ${routeUid} failed: ${e?.message || e}`));
        if (oldContextUid !== route.context_uid) {
          await this.routeApplyService.applyContext(oldContextUid, uid, false).catch((e: any) =>
            this.logger.error(`Apply old context ${oldContextUid} after update_route ${routeUid} failed: ${e?.message || e}`));
        }

        return { uid: route.uid, name: route.name, bindingsCount: ((route as any).bindings || []).length };
      },
    };
  }

  // ─── Regen trigger helper (D-18 pattern, shared by update/add/remove entries) ──

  private async reapplyIfVarKeysChanged(pbUid: number, vpbxUserUid: number, beforeKeys: string[], after: { entries?: any[] }): Promise<void> {
    const afterKeys = this.phonebooksService.collectAllVarKeys(after.entries || []);
    if (JSON.stringify(beforeKeys) !== JSON.stringify(afterKeys)) {
      await this.routeApplyService.applyContextsForPhonebook(pbUid, vpbxUserUid, false).catch((e: any) =>
        this.logger.error(`Re-apply routes after phonebook ${pbUid} var-key change failed: ${e?.message || e}`));
    }
  }
}
