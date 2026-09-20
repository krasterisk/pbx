"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ConferencesAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferencesAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const conference_moderation_service_1 = require("./conference-moderation.service");
const conference_rooms_service_1 = require("./conference-rooms.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const SCHEMA_VERSION = 'conferences-1';
const createInput = zod_1.z.strictObject({
    name: zod_1.z.string().trim().min(1).max(255),
    number: zod_1.z.string().regex(/^\d{2,8}$/).describe('Свободный короткий номер, например 700'),
    record_mode: zod_1.z.enum(['off', 'auto']).default('off'),
});
const updateInput = zod_1.z.strictObject({
    uid: zod_1.z.number().int().positive().describe('UID комнаты из list_conference_rooms'),
    name: zod_1.z.string().min(1).optional().describe('Название комнаты'),
    number: zod_1.z.string().regex(/^\d{1,32}$/).optional().describe('Короткий номер комнаты'),
    pin: zod_1.z.string().regex(/^\d{4,32}$/).nullable().optional().describe('PIN или null чтобы снять'),
    wait_marked: zod_1.z.boolean().optional(),
    end_marked: zod_1.z.boolean().optional(),
    record_mode: zod_1.z.enum(['off', 'auto', 'button', 'both']).optional(),
    notify_recording: zod_1.z.boolean().optional(),
    announce_join_leave: zod_1.z.boolean().optional(),
});
const updateArgs = zod_1.z.strictObject({
    uid: zod_1.z.number().int().positive(),
    name: zod_1.z.string().min(1),
    number: zod_1.z.string().regex(/^\d{1,32}$/),
    pin: zod_1.z.string().regex(/^\d{4,32}$/).nullable().optional(),
    wait_marked: zod_1.z.boolean(),
    end_marked: zod_1.z.boolean(),
    record_mode: zod_1.z.enum(['off', 'auto', 'button', 'both']),
    notify_recording: zod_1.z.boolean(),
    announce_join_leave: zod_1.z.boolean(),
});
/**
 * ConferencesAiAdapter — room read + proposal-gated update (D-41).
 * Live mute/kick land in Task 2; coverage flip is Task 3 only.
 */
let ConferencesAiAdapter = ConferencesAiAdapter_1 = class ConferencesAiAdapter {
    roomsService;
    moderationService;
    registry;
    logger = new common_1.Logger(ConferencesAiAdapter_1.name);
    domain = 'conferences';
    constructor(roomsService, moderationService, registry) {
        this.roomsService = roomsService;
        this.moderationService = moderationService;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('ConferencesAiAdapter registered');
    }
    getTools() {
        return [
            this.toolListConferenceRooms(),
            this.toolCreateConferenceRoom(),
            this.toolUpdateConferenceRoom(),
            this.toolForceMuteParticipant(),
            this.toolForceKickParticipant(),
        ];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Телеконференции
- Комната = uid + короткий number + имя. Список — list_conference_rooms (без SIP/канала).
- Настройки комнаты правятся через update_conference_room (proposal / diff, не live write).
- Новая внутренняя комната — create_conference_room. Название и свободный короткий номер; запись выключена по умолчанию.
- Заглушить или исключить участника — live-ops cf_force_mute_participant / cf_force_kick_participant.`;
    }
    async buildSummary(vpbxUserUid) {
        const rows = await this.roomsService.findAll(vpbxUserUid);
        if (rows.length === 0)
            return '';
        const names = rows
            .slice(0, 8)
            .map((row) => `${row.number} ${row.name}`.trim())
            .join(', ');
        return `Конференции: ${rows.length} комнат (${names})`;
    }
    toolListConferenceRooms() {
        return {
            name: 'list_conference_rooms',
            description: 'Список комнат тенанта: uid, короткий номер и имя. Без SIP, канала и ConfBridge id. Без изменений.',
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
    toolCreateConferenceRoom() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
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
                return this.proposal('create_conference_room', input.name, input, null, input, [`Создать конференцию «${input.name}», номер ${input.number}`, `Запись: ${input.record_mode}`]);
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
    toolUpdateConferenceRoom() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
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
    toolForceMuteParticipant() {
        return {
            name: 'cf_force_mute_participant',
            description: 'Заглушить участника живой комнаты. Деструктивная операция — confirm/dispatch, не draft.',
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
    toolForceKickParticipant() {
        return {
            name: 'cf_force_kick_participant',
            description: 'Исключить участника из живой комнаты. Деструктивная операция — confirm/dispatch, не draft.',
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
    async proposeUpdate(input, ctx) {
        const current = await this.roomsService.findOne(input.uid, ctx.vpbxUserUid);
        if (input.name == null &&
            input.number == null &&
            input.pin === undefined &&
            input.wait_marked == null &&
            input.end_marked == null &&
            input.record_mode == null &&
            input.notify_recording == null &&
            input.announce_join_leave == null) {
            return { refused: true, message: 'Нужно хотя бы одно поле для изменения комнаты' };
        }
        const applyArgs = {
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
        if (pin !== undefined)
            applyArgs.pin = pin;
        return this.proposal('update_conference_room', applyArgs.name, applyArgs, {
            name: current.name,
            number: current.number,
            pin: current.pin ?? null,
            wait_marked: Boolean(current.wait_marked),
            end_marked: Boolean(current.end_marked),
            record_mode: current.record_mode ?? 'off',
        }, applyArgs, this.updateSummary(current.name, applyArgs));
    }
    async revalidateUpdate(args, ctx) {
        try {
            await this.roomsService.findOne(args.uid, ctx.vpbxUserUid);
        }
        catch {
            return { ok: false, reason: `Комната ${args.uid} не найдена у тенанта` };
        }
        return { ok: true, args };
    }
    async applyUpdate(args, ctx) {
        const updated = await this.roomsService.update(args.uid, {
            name: args.name,
            number: args.number,
            pin: args.pin,
            wait_marked: args.wait_marked,
            end_marked: args.end_marked,
            record_mode: args.record_mode,
            notify_recording: args.notify_recording,
            announce_join_leave: args.announce_join_leave,
        }, ctx.vpbxUserUid);
        return { uid: updated.uid, name: updated.name, number: updated.number };
    }
    updateSummary(previousName, args) {
        const title = args.name !== previousName
            ? `Изменить комнату «${previousName}» → «${args.name}»`
            : `Изменить комнату «${args.name}»`;
        return [title, `номер ${args.number}`];
    }
    proposal(tool, label, args, before, after, summary) {
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
};
exports.ConferencesAiAdapter = ConferencesAiAdapter;
exports.ConferencesAiAdapter = ConferencesAiAdapter = ConferencesAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [conference_rooms_service_1.ConferenceRoomsService,
        conference_moderation_service_1.ConferenceModerationService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], ConferencesAiAdapter);
//# sourceMappingURL=conferences-ai.adapter.js.map