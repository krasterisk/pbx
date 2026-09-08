import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { toPublicExten } from '../../shared/utils/tenant-public-id.util';
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
import {
  defineMutationTool,
  type AiMutationContext,
  type AiToolRefusal,
  type MutationRevalidation,
} from '../ai-platform/ai-mutation.contract';

const STRATEGIES = ['ringall', 'hunt', 'memoryhunt', 'random'] as const;
const SCHEMA_VERSION = 'call-groups-1';

const memberSchema = z.strictObject({
  member_type: z.enum(['internal', 'external']).default('internal'),
  value: z.string().min(1).describe('Внутренний номер абонента или внешний номер'),
  position: z.number().int().min(0).optional(),
  ring_time: z.number().int().positive().optional(),
});

const createInput = z.strictObject({
  name: z.string().min(1).describe('Название группы'),
  exten: z.string().min(1).describe('Номер группы, 2–8 цифр'),
  strategy: z.enum(STRATEGIES).optional().describe(STRATEGIES.join(', ')),
  members: z.array(memberSchema).optional().describe('[{member_type, value, position, ring_time}]'),
});

const createArgs = z.strictObject({
  name: z.string().min(1),
  exten: z.string().min(1),
  strategy: z.enum(STRATEGIES).default('ringall'),
  members: z.array(memberSchema).optional(),
});

const updateMembersInput = z.strictObject({
  uid: z.number().int().positive().describe('UID группы'),
  members: z
    .array(memberSchema)
    .describe('Полный новый состав [{member_type, value, position, ring_time}]'),
});

const byUid = z.strictObject({ uid: z.number().int().positive().describe('UID группы') });

type CreateInput = z.infer<typeof createInput>;
type CreateArgs = z.infer<typeof createArgs>;
type UpdateMembersArgs = z.infer<typeof updateMembersInput>;
type ByUid = z.infer<typeof byUid>;
type MemberView = z.infer<typeof memberSchema>;

interface GroupView {
  uid: number;
  name: string;
  exten?: string;
  strategy?: string;
  members?: MemberView[];
}

/**
 * CallGroupsAiAdapter — call-group read and proposal-gated writes (D-15, D-18).
 * Tenant is a handler parameter. Membership is validated against this tenant's
 * subscribers both when the card is built and again when it is confirmed, so a
 * subscriber deleted in between stops the write instead of ringing nothing.
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
- Номер группы — 2–8 цифр, уникален среди групп, очередей и внутренних номеров тенанта. Занятый номер (например внутренний 110) адаптер сам меняет на свободный 6xxx в карточке — не спрашивай пользователя.
- Член internal — extension абонента этого тенанта. Несуществующий extension отвергается до карточки.
- «группа 201-203» = одна новая группа с точно этими членами. Не подставляй чужой uid, даже если в нём есть один из номеров.`;
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
    return defineMutationTool<CreateInput, CreateArgs>({
      name: 'create_call_group',
      description: 'Предлагает создать группу вызова. Члены-абоненты проверяются по тенанту.',
      entityType: 'call_group',
      schemaVersion: SCHEMA_VERSION,
      input: createInput,
      args: createArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const members = this.publicMembers(input.members, ctx.vpbxUserUid);
        const refused = await this.refuseUnknownMembers(members, ctx.vpbxUserUid);
        if (refused) return refused;

        let exten = toPublicExten(input.exten, ctx.vpbxUserUid);
        const occupied = await this.callGroupsService.checkExtenConflict(exten, ctx.vpbxUserUid);
        let replaced: string | undefined;
        if (occupied) {
          replaced = exten;
          exten = await this.callGroupsService.suggestFreeExten(ctx.vpbxUserUid);
        }

        const applyArgs: CreateArgs = {
          name: input.name,
          exten,
          strategy: input.strategy ?? 'ringall',
        };
        if (members.length) applyArgs.members = members;

        return this.proposal(
          'create_call_group',
          applyArgs.name || applyArgs.exten,
          applyArgs,
          null,
          applyArgs,
          this.createGroupSummary(applyArgs, replaced),
        );
      },
      revalidate: (args, ctx) => this.revalidateCreate(args, ctx),
      apply: async (args, ctx) => {
        await this.callGroupsService.create(
          {
            ...args,
            exten: toPublicExten(args.exten, ctx.vpbxUserUid),
            members: this.publicMembers(args.members, ctx.vpbxUserUid),
          } as never,
          ctx.vpbxUserUid,
        );
      },
    });
  }

  private toolUpdateMembers(): AiToolDefinition {
    return defineMutationTool<UpdateMembersArgs, UpdateMembersArgs>({
      name: 'update_call_group_members',
      description:
        'Предлагает заменить состав группы. В карточке — кого добавляем и кого убираем, не итоговый список.',
      entityType: 'call_group',
      schemaVersion: SCHEMA_VERSION,
      input: updateMembersInput,
      args: updateMembersInput,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const current = await this.callGroupsService.findOne(input.uid, ctx.vpbxUserUid);
        const members = this.publicMembers(input.members, ctx.vpbxUserUid);
        const refused = await this.refuseUnknownMembers(members, ctx.vpbxUserUid);
        if (refused) return refused;

        const beforeValues = memberValues(current.members);
        const afterValues = memberValues(members);
        const added = afterValues.filter((value) => !beforeValues.includes(value));
        const removed = beforeValues.filter((value) => !afterValues.includes(value));

        return this.proposal(
          'update_call_group_members',
          String(current.name),
          { uid: input.uid, members },
          { members: beforeValues },
          { members: afterValues, added, removed },
          this.membershipSummary(added, removed),
        );
      },
      revalidate: async (args, ctx) => {
        const owned = await this.requireGroup(args, args.uid, ctx);
        if (!owned.ok) return owned;
        return this.revalidateMembers(args, args.members, ctx);
      },
      apply: async (args, ctx) => {
        await this.callGroupsService.update(
          args.uid,
          { members: this.publicMembers(args.members, ctx.vpbxUserUid) } as never,
          ctx.vpbxUserUid,
        );
      },
    });
  }

  private toolDeleteCallGroup(): AiToolDefinition {
    return defineMutationTool<ByUid, ByUid>({
      name: 'delete_call_group',
      description: 'Предлагает удалить группу. В карточке — маршруты и меню, которые на неё звонят.',
      entityType: 'call_group',
      destructive: true,
      schemaVersion: SCHEMA_VERSION,
      input: byUid,
      args: byUid,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const current = await this.callGroupsService.findOne(input.uid, ctx.vpbxUserUid);
        const feeders = await this.feederNames(input.uid, current.exten, ctx.vpbxUserUid);
        const summary = [
          `Удалить группу ${current.name}`,
          ...feeders.routes.map((route) => `Маршрут: ${route}`),
          ...feeders.menus.map((menu) => `Меню: ${menu}`),
        ];
        return this.proposal(
          'delete_call_group',
          String(current.name),
          { uid: input.uid },
          this.toListRow(current),
          null,
          summary,
        );
      },
      revalidate: (args, ctx) => this.requireGroup(args, args.uid, ctx),
      apply: async (args, ctx) => {
        await this.callGroupsService.remove(args.uid, ctx.vpbxUserUid);
      },
    });
  }

  private publicMembers(members: MemberView[] | undefined, uid: number): MemberView[] {
    return (members ?? []).map((member) =>
      member.member_type === 'internal'
        ? { ...member, value: toPublicExten(member.value, uid) }
        : member,
    );
  }

  private async requireGroup<T>(
    args: T,
    groupUid: number,
    ctx: AiMutationContext,
  ): Promise<MutationRevalidation<T>> {
    try {
      await this.callGroupsService.findOne(groupUid, ctx.vpbxUserUid);
      return { ok: true, args };
    } catch {
      return { ok: false, reason: `Группа ${groupUid} не найдена у тенанта` };
    }
  }

  private async revalidateCreate(
    args: CreateArgs,
    ctx: AiMutationContext,
  ): Promise<MutationRevalidation<CreateArgs>> {
    const membersCheck = await this.revalidateMembers(args, args.members, ctx);
    if (!membersCheck.ok) return membersCheck;
    const conflict = await this.callGroupsService.checkExtenConflict(args.exten, ctx.vpbxUserUid);
    if (conflict) {
      return { ok: false, reason: `Номер группы ${args.exten} занят (${conflict.reason})` };
    }
    return { ok: true, args };
  }

  private async revalidateMembers<T>(
    args: T,
    members: MemberView[] | undefined,
    ctx: AiMutationContext,
  ): Promise<MutationRevalidation<T>> {
    const refused = await this.refuseUnknownMembers(
      this.publicMembers(members, ctx.vpbxUserUid),
      ctx.vpbxUserUid,
    );
    if (refused) return { ok: false, reason: String(refused.message) };
    return { ok: true, args };
  }

  private createGroupSummary(args: CreateArgs, replaced?: string): string[] {
    const members = (args.members ?? []).map((member) => member.value).filter(Boolean);
    const lines = [
      `Создать группу ${args.name}`,
      replaced
        ? `Номер ${args.exten} (вместо занятого ${replaced})`
        : `Номер ${args.exten}`,
      `Стратегия ${args.strategy}`,
    ];
    if (members.length) lines.push(`Участники: ${members.join(', ')}`);
    return lines;
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
  ): Promise<AiToolRefusal | null> {
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
        value: member.member_type === 'internal' ? toPublicExten(member.value) : member.value,
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

function memberValues(members: MemberView[] | undefined): string[] {
  return (members ?? []).map((member) => member.value).filter(Boolean);
}
