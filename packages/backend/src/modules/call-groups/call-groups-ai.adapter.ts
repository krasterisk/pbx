import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CallGroupsService } from './call-groups.service';
import { EndpointsService } from '../endpoints/endpoints.service';
import { RouteReferencesService } from '../route-references/route-references.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AiToolDefinition,
  AiStateProvider,
  DomainAiAdapter,
  AgentDiffProposal,
} from '../ai-platform/ai-adapter.types';

const STRATEGIES = ['ringall', 'hunt', 'memoryhunt', 'random'] as const;

interface MemberView {
  member_type: 'internal' | 'external';
  value: string;
  position?: number;
  ring_time?: number;
}

interface GroupView {
  uid: number;
  name: string;
  exten?: string;
  strategy?: string;
  members?: MemberView[];
}

/**
 * CallGroupsAiAdapter — call-group read and proposal-gated writes (D-15, D-18).
 * Tenant is a handler parameter. Membership is validated against this tenant's subscribers.
 */
@Injectable()
export class CallGroupsAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(CallGroupsAiAdapter.name);
  readonly domain = 'call-groups';

  constructor(
    private readonly callGroupsService: CallGroupsService,
    private readonly registry: AiAdapterRegistryService,
    private readonly endpointsService: EndpointsService,
    private readonly routeReferencesService: RouteReferencesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('CallGroupsAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolListCallGroups(),
      this.toolCreateCallGroup(),
      this.toolUpdateMembers(),
      this.toolDeleteCallGroup(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Группы вызова
- Стратегии: ${STRATEGIES.join(', ')}. Группа звонит фиксированному списку, очередь ставит в ожидание.
- Номер группы — 2–8 цифр, уникален среди групп, очередей и внутренних номеров тенанта.
- Член internal — extension абонента этого тенанта. Несуществующий extension отвергается до карточки.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const groups = await this.callGroupsService.findAll(vpbxUserUid);
    if (groups.length === 0) return '';
    const names = groups.map((group) => `${group.name} (${group.exten}, ${group.strategy})`).join(', ');
    return `Группы вызова: ${names}`;
  }

  private toolListCallGroups(): AiToolDefinition {
    return {
      name: 'list_call_groups',
      description: 'Список групп вызова тенанта: номер, стратегия и состав. Без изменений.',
      inputSchema: {},
      entityType: 'call_group',
      handler: async (_args, uid) => {
        const rows = await this.callGroupsService.findAll(uid);
        return { groups: rows.map((row) => this.toListRow(row)) };
      },
    };
  }

  private toolCreateCallGroup(): AiToolDefinition {
    return {
      name: 'create_call_group',
      description: 'Предлагает создать группу вызова. Члены-абоненты проверяются по тенанту.',
      inputSchema: {
        name: { type: 'string', description: 'Название группы' },
        exten: { type: 'string', description: 'Номер группы, 2–8 цифр' },
        strategy: { type: 'string', description: STRATEGIES.join(', ') },
        members: { type: 'array', description: '[{member_type, value, position, ring_time}]' },
      },
      entityType: 'call_group',
      proposes: true,
      handler: async (args, uid) => {
        const members = asMembers(args.members);
        const refused = await this.refuseUnknownMembers(members, uid);
        if (refused) return refused;

        const applyArgs: Record<string, unknown> = {
          name: String(args.name ?? ''),
          exten: String(args.exten ?? ''),
          strategy: args.strategy != null ? String(args.strategy) : 'ringall',
        };
        if (members.length) applyArgs.members = members;

        return this.proposal(
          'create_call_group',
          String(applyArgs.name || applyArgs.exten),
          applyArgs,
          null,
          applyArgs,
          [`Создать группу ${applyArgs.name || applyArgs.exten}`],
        );
      },
    };
  }

  private toolUpdateMembers(): AiToolDefinition {
    return {
      name: 'update_call_group_members',
      description:
        'Предлагает заменить состав группы. В карточке — кого добавляем и кого убираем, не итоговый список.',
      inputSchema: {
        uid: { type: 'number', description: 'UID группы' },
        members: { type: 'array', description: 'Полный новый состав [{member_type, value, position, ring_time}]' },
      },
      entityType: 'call_group',
      proposes: true,
      handler: async (args, uid) => {
        const groupUid = Number(args.uid);
        const current = await this.callGroupsService.findOne(groupUid, uid);
        const members = asMembers(args.members);
        const refused = await this.refuseUnknownMembers(members, uid);
        if (refused) return refused;

        const beforeValues = memberValues(current.members);
        const afterValues = memberValues(members);
        const added = afterValues.filter((value) => !beforeValues.includes(value));
        const removed = beforeValues.filter((value) => !afterValues.includes(value));

        const applyArgs: Record<string, unknown> = { uid: groupUid, members };
        return this.proposal(
          'update_call_group_members',
          String(current.name),
          applyArgs,
          { members: beforeValues },
          { members: afterValues, added, removed },
          this.membershipSummary(added, removed),
        );
      },
    };
  }

  private toolDeleteCallGroup(): AiToolDefinition {
    return {
      name: 'delete_call_group',
      description: 'Предлагает удалить группу. В карточке — маршруты и меню, которые на неё звонят.',
      inputSchema: { uid: { type: 'number', description: 'UID группы' } },
      entityType: 'call_group',
      destructive: true,
      proposes: true,
      handler: async (args, uid) => {
        const groupUid = Number(args.uid);
        const current = await this.callGroupsService.findOne(groupUid, uid);
        const feeders = await this.feederNames(groupUid, current.exten, uid);
        const summary = [
          `Удалить группу ${current.name}`,
          ...feeders.routes.map((route) => `Маршрут: ${route}`),
          ...feeders.menus.map((menu) => `Меню: ${menu}`),
        ];
        return this.proposal(
          'delete_call_group',
          String(current.name),
          { uid: groupUid },
          this.toListRow(current),
          null,
          summary,
        );
      },
    };
  }

  private membershipSummary(added: string[], removed: string[]): string[] {
    const lines: string[] = [];
    if (added.length) lines.push(`Добавить ${added.join(', ')}`);
    if (removed.length) lines.push(`Удалить ${removed.join(', ')}`);
    if (lines.length === 0) lines.push('Состав группы без изменений');
    return lines;
  }

  private async refuseUnknownMembers(
    members: MemberView[],
    uid: number,
  ): Promise<Record<string, unknown> | null> {
    const internals = members
      .filter((member) => member.member_type === 'internal')
      .map((member) => member.value.trim())
      .filter(Boolean);
    if (!internals.length) return null;

    const endpoints = await this.endpointsService.findAll(uid);
    const known = new Set(endpoints.map((row) => String(row.extension)));
    const missing = [...new Set(internals.filter((exten) => !known.has(exten)))];
    if (!missing.length) return null;

    return {
      refused: true,
      destination: missing[0],
      message: `Абонент ${missing.join(', ')} не найден у тенанта`,
    };
  }

  private async feederNames(
    groupUid: number,
    exten: string | undefined,
    uid: number,
  ): Promise<{ routes: string[]; menus: string[] }> {
    const keys = [groupUid, exten].filter((value) => value != null && value !== '') as Array<number | string>;
    const routes = new Set<string>();
    const menus = new Set<string>();
    for (const key of keys) {
      const usage = await this.routeReferencesService.findUsage('group', key, uid);
      for (const ref of usage.references ?? []) {
        if (ref.routeName) routes.add(ref.routeName);
        if (ref.ivrName) menus.add(ref.ivrName);
      }
    }
    return { routes: [...routes], menus: [...menus] };
  }

  private toListRow(row: GroupView): Record<string, unknown> {
    return {
      uid: row.uid,
      name: row.name,
      exten: row.exten ?? null,
      strategy: row.strategy ?? null,
      members: (row.members ?? []).map((member) => ({
        member_type: member.member_type,
        value: member.value,
        position: member.position,
        ring_time: member.ring_time,
      })),
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
      entityType: 'call_group',
      entityLabel: label,
      summary,
      before,
      after,
      applyPayload: { tool, args },
      includesDialplanReload: false,
    };
  }
}

function asMembers(value: unknown): MemberView[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const rec = row as Record<string, unknown>;
      return {
        member_type: rec.member_type === 'external' ? 'external' : 'internal',
        value: String(rec.value ?? '').trim(),
        position: rec.position != null ? Number(rec.position) : undefined,
        ring_time: rec.ring_time != null ? Number(rec.ring_time) : undefined,
      };
    })
    .filter((member) => member.value);
}

function memberValues(members: MemberView[] | undefined): string[] {
  return (members ?? []).map((member) => member.value).filter(Boolean);
}
