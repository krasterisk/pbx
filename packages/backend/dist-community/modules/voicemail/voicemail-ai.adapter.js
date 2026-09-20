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
var VoicemailAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoicemailAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const voicemail_service_1 = require("./voicemail.service");
/**
 * VoicemailAiAdapter — Domain AI Adapter for tenant voicemail messages (D-58).
 *
 * Read-only tools, registered through AiAdapterRegistryService (MCP + /api/ai-tools/*).
 * Every handler receives `vpbxUserUid` as a call parameter — never closed over (D-23).
 * Payloads never include the opaque play-token URL (T-13-22).
 */
let VoicemailAiAdapter = VoicemailAiAdapter_1 = class VoicemailAiAdapter {
    voicemailService;
    registry;
    logger = new common_1.Logger(VoicemailAiAdapter_1.name);
    domain = 'voicemail';
    constructor(voicemailService, registry) {
        this.voicemailService = voicemailService;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('VoicemailAiAdapter registered');
    }
    getTools() {
        return [this.toolListVoicemailMessages(), this.toolGetVoicemailMessage()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Голосовая почта (Voicemail)
- Сообщение = WAV после Record() + две независимые оси статуса: notify_status и transcript_status.
- notify_status: pending | sent | failed. transcript_status: pending | ready | failed | not_configured.
- Операторы читают сообщения на вкладке CDR-отчёта (Surface L), не через VoiceMailMain.
- MWI / mailbox / VoiceMail() в продукте нет и не используется.
- Расшифровка опциональна: нет STT/LLM — файл и notify уже есть, это не авария АТС.
- Воспроизведение только по JWT или одноразовой ссылке уведомления; AI-инструменты токен не отдают.`;
    }
    async buildSummary(vpbxUserUid) {
        const messages = await this.voicemailService.list(vpbxUserUid);
        if (messages.length === 0)
            return '';
        return `Голосовая почта: ${messages.length} сообщений`;
    }
    toolListVoicemailMessages() {
        return {
            name: 'list_voicemail_messages',
            description: 'Список сообщений голосовой почты тенанта: uniqueid, caller, exten, две оси статуса, краткое summary. Без URL воспроизведения.',
            inputSchema: {},
            entityType: 'voicemail_message',
            handler: async (_args, vpbxUserUid) => {
                const rows = await this.voicemailService.list(vpbxUserUid);
                return { messages: rows.map((row) => this.toSafeMessage(row)) };
            },
        };
    }
    toolGetVoicemailMessage() {
        return {
            name: 'get_voicemail_message',
            description: 'Одно сообщение голосовой почты по uniqueid в пределах тенанта. Чужой uniqueid — not-found. Без URL воспроизведения.',
            inputSchema: {
                uniqueid: { type: 'string', description: 'Asterisk UNIQUEID сообщения' },
            },
            entityType: 'voicemail_message',
            handler: async (args, vpbxUserUid) => {
                try {
                    const row = await this.voicemailService.findByUniqueid(vpbxUserUid, String(args.uniqueid ?? ''));
                    return this.toSafeMessage(row);
                }
                catch (err) {
                    if (err instanceof common_1.NotFoundException) {
                        return { found: false };
                    }
                    throw err;
                }
            },
        };
    }
    /** Whitelist IVoicemailMessage fields — never token / play-by-token / notify_dispatch. */
    toSafeMessage(row) {
        return {
            uid: row.uid,
            vpbx_user_uid: row.vpbx_user_uid ?? row.user_uid,
            uniqueid: row.uniqueid,
            file_rel: row.file_rel,
            record_status: row.record_status ?? '',
            caller_id: row.caller_id ?? '',
            exten: row.exten ?? '',
            duration_sec: row.duration_sec ?? undefined,
            notify_status: row.notify_status,
            transcript_status: row.transcript_status,
            notify_attempts: row.notify_attempts ?? 0,
            transcript_attempts: row.transcript_attempts ?? 0,
            next_notify_at: row.next_notify_at ?? null,
            scan_locked_until: row.scan_locked_until ?? null,
            transcript: row.transcript ?? undefined,
            summary: row.summary ?? undefined,
            notify_error: row.notify_error ?? undefined,
            created_at: row.created_at,
        };
    }
};
exports.VoicemailAiAdapter = VoicemailAiAdapter;
exports.VoicemailAiAdapter = VoicemailAiAdapter = VoicemailAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [voicemail_service_1.VoicemailService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], VoicemailAiAdapter);
//# sourceMappingURL=voicemail-ai.adapter.js.map