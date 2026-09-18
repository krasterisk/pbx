import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { ConferenceModerationService } from './conference-moderation.service';
import { ConferenceRoomsService } from './conference-rooms.service';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  AgentDiffProposal,
  AiStateProvider,
  AiToolDefinition,
  DomainAiAdapter,
} from '../ai-platform/ai-adapter.types';
import {
  defineMutationTool,
  type AiMutationContext,
  type AiToolRefusal,
} from '../ai-platform/ai-mutation.contract';

const SCHEMA_VERSION = 'conferences-1';

const createInput = z.strictObject({
  name: z.string().trim().min(1).max(255),
  number: z.string().regex(/^\d{2,8}$/).describe('Свободный короткий номер, например 700'),
  record_mode: z.enum(['off', 'auto']).default('off'),
});
type CreateInput = z.infer<typeof createInput>;

const updateInput = z.strictObject({
  uid: z.number().int().positive().describe('UID комнаты из list_conference_rooms'),
  name: z.string().min(1).optional().describe('Название комнаты'),
  number: z.string().regex(/^\d{1,32}$/).optional().describe('Короткий номер комнаты'),
  pin: z.string().regex(/^\d{4,32}$/).nullable().optional().describe('PIN или null чтобы снять'),
  wait_marked: z.boolean().optional(),
  end_marked: z.boolean().optional(),
  record_mode: z.enum(['off', 'auto', 'button', 'both']).optional(),
  notify_recording: z.boolean().optional(),
  announce_join_leave: z.boolean().optional(),
});

const updateArgs = z.strictObject({
  uid: z.number().int().positive(),
  name: z.string().min(1),
  number: z.string().regex(/^\d{1,32}$/),
  pin: z.string().regex(/^\d{4,32}$/).nullable().optional(),
  wait_marked: z.boolean(),
  end_marked: z.boolean(),
  record_mode: z.enum(['off', 'auto', 'button', 'both']),
  notify_recording: z.boolean(),
  announce_join_leave: z.boolean(),
});

type UpdateInput = z.infer<typeof updateInput>;
type UpdateArgs = z.infer<typeof updateArgs>;

/**
 * ConferencesAiAdapter — room read + proposal-gated update (D-41).
 * Live mute/kick land in Task 2; coverage flip is Task 3 only.
 */
@Injectable()
export class ConferencesAiAdapter implements DomainAiAdapter, OnModuleInit {
  private readonly logger = new Logger(ConferencesAiAdapter.name);
  readonly domain = 'conferences';

  constructor(
    private readonly roomsService: ConferenceRoomsService,
    private readonly moderationService: ConferenceModerationService,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('ConferencesAiAdapter registered');
  }

  getTools(): AiToolDefinition[] {
    return [
      this.toolListConferenceRooms(),
      this.toolCreateConferenceRoom(),
      this.toolUpdateConferenceRoom(),
      this.toolForceMuteParticipant(),
      this.toolForceKickParticipant(),
    ];
  }

  getStateProvider(): AiStateProvider {
    return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
  }

  getKnowledgeBlock(): string {
    return `## Телеконференции
- Комната = uid + короткий number + имя. Список — list_conference_rooms (без SIP/канала).
- Настройки комнаты правятся через update_conference_room (proposal / diff, не live write).
- Новая внутренняя комната — create_conference_room. Название и свободный короткий номер; запись выключена по умолчанию.
- Заглушить или исключить участника — live-ops cf_force_mute_participant / cf_force_kick_participant.`;
  }

  private async buildSummary(vpbxUserUid: number): Promise<string> {
    const rows = await this.roomsService.findAll(vpbxUserUid);
    if (rows.length === 0) return '';
    const names = rows
      .slice(0, 8)
      .map((row) => `${row.number} ${row.name}`.trim())
      .join(', ');
    return `Конференции: ${rows.length} комнат (${names})`;
  }

  private toolListConferenceRooms(): AiToolDefinition {
    return {
      name: 'list_conference_rooms',
      description:
        'Список комнат тенанта: uid, короткий номер и имя. Без SIP, канала и ConfBridge id. Без изменений.',
      inputSchema: {},
      entityType: 'conference_room',
      handler: async (_args, vpbxUserUid) => {
        const rows = await this.roomsService.findAll(vpbxUserUid);
        return {
          rooms: rows.map((row) => ({
            uid: row.uid,
            number: row.number,
            name: row.name,
          })),
        };
      },
    };
  }

  private toolCreateConferenceRoom(): AiToolDefinition {
    return defineMutationTool<CreateInput, CreateInput>({
      name: 'create_conference_room',
      description: 'Подготовить создание внутренней комнаты конференций. Требует подтверждения. Без гостевых ссылок и PIN; запись по умолчанию выключена.',
      entityType: 'conference_room',
      schemaVersion: SCHEMA_VERSION,
      input: createInput,
      args: createInput,
      reload: { kind: 'none' },
      propose: async (input, ctx) => {
        const rooms = await this.roomsService.findAll(ctx.vpbxUserUid);
        if (rooms.some((room) => room.number === input.number)) {
          return { refused: true, message: `Комната ${input.number} уже существует` };
        }
        return this.proposal('create_conference_room', input.name, input, null, input,
          [`Создать конференцию «${input.name}», номер ${input.number}`, `Запись: ${input.record_mode}`]);
      },
      revalidate: async (args, ctx) => {
        const rooms = await this.roomsService.findAll(ctx.vpbxUserUid);
        return rooms.some((room) => room.number === args.number)
          ? { ok: false, reason: `Комната ${args.number} уже существует` }
          : { ok: true, args };
      },
      apply: async (args, ctx) => {
        const room = await this.roomsService.create({ ...args, kind: 'permanent',
          invite_external_scope: 'owner', notify_recording: true }, ctx.vpbxUserUid, ctx.userUid);
        return { uid: room.uid, name: room.name, number: room.number };
      },
    });
  }

  private toolUpdateConferenceRoom(): AiToolDefinition {
    return defineMutationTool<UpdateInput, UpdateArgs>({
      name: 'update_conference_room',
      description: 'Предлагает изменить настройки существующей комнаты тенанта. Не пишет сразу — только diff.',
      entityType: 'conference_room',
      schemaVersion: SCHEMA_VERSION,
      input: updateInput,
      args: updateArgs,
      reload: { kind: 'none' },
      propose: async (input, ctx) => this.proposeUpdate(input, ctx),
      revalidate: async (args, ctx) => this.revalidateUpdate(args, ctx),
      apply: async (args, ctx) => this.applyUpdate(args, ctx),
    });
  }

  private toolForceMuteParticipant(): AiToolDefinition {
    return {
      name: 'cf_force_mute_participant',
      description:
        'Заглушить участника живой комнаты. Деструктивная операция — confirm/dispatch, не draft.',
      inputSchema: {
        room_uid: { type: 'number', description: 'UID комнаты из list_conference_rooms' },
        ref: { type: 'string', description: 'DTO ref участника, не Asterisk channel' },
      },
      entityType: 'conference_participant',
      destructive: true,
      handler: async (args, vpbxUserUid) => {
        const roomUid = Number(args.room_uid);
        const ref = String(args.ref ?? '');
        await this.moderationService.muteParticipant(roomUid, ref, {
          sub: 0,
          vpbx_user_uid: vpbxUserUid,
        });
        return { ok: true, room_uid: roomUid, ref };
      },
    };
  }

  private toolForceKickParticipant(): AiToolDefinition {
    return {
      name: 'cf_force_kick_participant',
      description:
        'Исключить участника из живой комнаты. Деструктивная операция — confirm/dispatch, не draft.',
      inputSchema: {
        room_uid: { type: 'number', description: 'UID комнаты из list_conference_rooms' },
        ref: { type: 'string', description: 'DTO ref участника, не Asterisk channel' },
      },
      entityType: 'conference_participant',
      destructive: true,
      handler: async (args, vpbxUserUid) => {
        const roomUid = Number(args.room_uid);
        const ref = String(args.ref ?? '');
        await this.moderationService.kickParticipant(roomUid, ref, {
          sub: 0,
          vpbx_user_uid: vpbxUserUid,
        });
        return { ok: true, room_uid: roomUid, ref };
      },
    };
  }

  private async proposeUpdate(
    input: UpdateInput,
    ctx: AiMutationContext,
  ): Promise<AgentDiffProposal | AiToolRefusal> {
    const current = await this.roomsService.findOne(input.uid, ctx.vpbxUserUid);
    if (
      input.name == null &&
      input.number == null &&
      input.pin === undefined &&
      input.wait_marked == null &&
      input.end_marked == null &&
      input.record_mode == null &&
      input.notify_recording == null &&
      input.announce_join_leave == null
    ) {
      return { refused: true, message: 'Нужно хотя бы одно поле для изменения комнаты' };
    }

    const applyArgs: UpdateArgs = {
      uid: input.uid,
      name: (input.name ?? current.name).trim(),
      number: input.number ?? current.number,
      wait_marked: input.wait_marked ?? Boolean(current.wait_marked),
      end_marked: input.end_marked ?? Boolean(current.end_marked),
      record_mode: input.record_mode ?? current.record_mode ?? 'off',
      notify_recording: input.notify_recording ?? Boolean(current.notify_recording),
      announce_join_leave: input.announce_join_leave ?? Boolean(current.announce_join_leave),
    };
    const pin = input.pin !== undefined ? input.pin : current.pin;
    if (pin !== undefined) applyArgs.pin = pin;

    return this.proposal(
      'update_conference_room',
      applyArgs.name,
      applyArgs,
      {
        name: current.name,
        number: current.number,
        pin: current.pin ?? null,
        wait_marked: Boolean(current.wait_marked),
        end_marked: Boolean(current.end_marked),
        record_mode: current.record_mode ?? 'off',
      },
      applyArgs,
      this.updateSummary(current.name, applyArgs),
    );
  }

  private async revalidateUpdate(args: UpdateArgs, ctx: AiMutationContext) {
    try {
      await this.roomsService.findOne(args.uid, ctx.vpbxUserUid);
    } catch {
      return { ok: false as const, reason: `Комната ${args.uid} не найдена у тенанта` };
    }
    return { ok: true as const, args };
  }

  private async applyUpdate(args: UpdateArgs, ctx: AiMutationContext) {
    const updated = await this.roomsService.update(
      args.uid,
      {
        name: args.name,
        number: args.number,
        pin: args.pin,
        wait_marked: args.wait_marked,
        end_marked: args.end_marked,
        record_mode: args.record_mode,
        notify_recording: args.notify_recording,
        announce_join_leave: args.announce_join_leave,
      },
      ctx.vpbxUserUid,
    );
    return { uid: updated.uid, name: updated.name, number: updated.number };
  }

  private updateSummary(previousName: string, args: UpdateArgs): string[] {
    const title =
      args.name !== previousName
        ? `Изменить комнату «${previousName}» → «${args.name}»`
        : `Изменить комнату «${args.name}»`;
    return [title, `номер ${args.number}`];
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
      entityType: 'conference_room',
      entityLabel: label,
      summary,
      before,
      after,
      applyPayload: { tool, args },
      includesDialplanReload: false,
    };
  }
}
