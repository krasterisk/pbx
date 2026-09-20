"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var VoicemailScannerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoicemailScannerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const fs = __importStar(require("fs"));
const sequelize_2 = require("sequelize");
const ai_providers_service_1 = require("../ai-connectivity/ai-providers.service");
const stt_engines_service_1 = require("../stt-engines/stt-engines.service");
const system_settings_service_1 = require("../system-settings/system-settings.service");
const provider_factory_1 = require("../voice-robots/providers/provider-factory");
const llm_summary_service_1 = require("./llm-summary.service");
const voicemail_message_model_1 = require("./voicemail-message.model");
const voicemail_service_1 = require("./voicemail.service");
const wav_pcm_util_1 = require("./wav-pcm.util");
const SCAN_INTERVAL_MS = 30_000;
const SCAN_LEASE_MS = 60_000;
const NOTIFY_BATCH = 20;
const TRANSCRIPT_BATCH = 20;
const MAX_NOTIFY_ATTEMPTS = 3;
const MAX_TRANSCRIPT_ATTEMPTS = 3;
const NOTIFY_BACKOFF_MS = [60_000, 4 * 60_000];
const MAX_WAV_BYTES = 20 * 1024 * 1024;
const MIN_LLM_CHARS = 8;
let VoicemailScannerService = VoicemailScannerService_1 = class VoicemailScannerService {
    messages;
    voicemail;
    sttEngines;
    sttFactory;
    llm;
    aiProviders;
    systemSettings;
    logger = new common_1.Logger(VoicemailScannerService_1.name);
    running = false;
    constructor(messages, voicemail, sttEngines, sttFactory, llm, aiProviders, systemSettings) {
        this.messages = messages;
        this.voicemail = voicemail;
        this.sttEngines = sttEngines;
        this.sttFactory = sttFactory;
        this.llm = llm;
        this.aiProviders = aiProviders;
        this.systemSettings = systemSettings;
    }
    async tick() {
        if (this.running)
            return;
        this.running = true;
        try {
            await this.scanOnce();
        }
        catch (e) {
            this.logger.warn(`vm scan: ${e.message}`);
        }
        finally {
            this.running = false;
        }
    }
    async scanOnce() {
        const now = new Date();
        const notifyDue = await this.messages.findAll({
            where: {
                notify_status: 'pending',
                next_notify_at: { [sequelize_2.Op.lte]: now },
                [sequelize_2.Op.or]: [
                    { scan_locked_until: null },
                    { scan_locked_until: { [sequelize_2.Op.lte]: now } },
                ],
            },
            limit: NOTIFY_BATCH,
        });
        const transcriptDue = this.sttEngines && this.sttFactory
            ? await this.messages.findAll({
                where: { transcript_status: 'pending' },
                limit: TRANSCRIPT_BATCH,
            })
            : [];
        for (const row of notifyDue) {
            await row.update({
                scan_locked_until: new Date(Date.now() + SCAN_LEASE_MS),
            });
            try {
                await this.voicemail.retryNotify(row);
                await row.update({
                    notify_status: 'sent',
                    notify_error: null,
                    scan_locked_until: null,
                });
            }
            catch (e) {
                await this.markNotifyFail(row, e.message ?? 'notify_error');
            }
        }
        for (const row of transcriptDue) {
            await this.processTranscript(row);
        }
    }
    async retryTranscript(uniqueid, userUid) {
        const row = await this.messages.findOne({ where: { uniqueid, user_uid: userUid } });
        if (!row)
            return;
        await row.update({
            transcript_status: 'pending',
            transcript_attempts: 0,
        });
    }
    async processTranscript(row) {
        const engine = await this.resolveEngine(row);
        if (!engine) {
            await row.update({ transcript_status: 'not_configured' });
            return;
        }
        try {
            const cfg = await this.systemSettings.getServerConfigRaw();
            const basePath = cfg.records_base_path || '/usr/records';
            const filePath = (0, voicemail_service_1.safeVoicemailFilePath)(basePath, row.file_rel);
            if (!filePath) {
                throw new Error('file_missing');
            }
            const stat = await fs.promises.stat(filePath);
            if (stat.size > MAX_WAV_BYTES) {
                throw new Error('wav_too_large');
            }
            const wavBuf = await fs.promises.readFile(filePath);
            const pcm = (0, wav_pcm_util_1.parseWavPcm16)(wavBuf);
            if (pcm.sampleRate !== 8000 || pcm.channels !== 1) {
                throw new Error('bad wav');
            }
            const stt = await this.sttFactory.transcribe(engine, pcm.pcm, 'ru-RU');
            const transcript = String(stt.text ?? '').trim();
            await row.update({ transcript });
            const provider = await this.pickLlm(row);
            if (!provider || transcript.length < MIN_LLM_CHARS) {
                await row.update({ transcript_status: 'ready', summary: row.summary ?? '' });
                return;
            }
            const raw = await this.llm.summarize(provider, transcript);
            const parsed = (0, llm_summary_service_1.parseAndValidateSummary)(raw, transcript);
            await row.update({ transcript_status: 'ready', summary: parsed.summary });
        }
        catch (e) {
            this.logger.warn(`vm stt uid=${row.uid}: ${e.message}`);
            await this.markTranscriptFail(row);
        }
    }
    readStepEngineUids(row) {
        const raw = row.notify_dispatch;
        if (!raw)
            return {};
        try {
            const parsed = JSON.parse(raw);
            const stt = Number(parsed.stt_engine_uid);
            const llm = Number(parsed.llm_provider_uid);
            return {
                stt: Number.isInteger(stt) && stt > 0 ? stt : undefined,
                llm: Number.isInteger(llm) && llm > 0 ? llm : undefined,
            };
        }
        catch {
            return {};
        }
    }
    async resolveEngine(row) {
        const stepUid = this.readStepEngineUids(row).stt;
        if (stepUid != null) {
            try {
                return await this.sttEngines.findOne(stepUid, row.user_uid);
            }
            catch {
                // fall through to tenant default
            }
        }
        const all = await this.sttEngines.findAll(row.user_uid);
        return all[0] ?? null;
    }
    async pickLlm(row) {
        if (!this.aiProviders || !this.llm)
            return null;
        const stepUid = this.readStepEngineUids(row).llm;
        const all = await this.aiProviders.findAll(row.user_uid);
        const httpLlm = all.filter((p) => (p.enabled
            && Array.isArray(p.capabilities)
            && p.capabilities.includes('llm')
            && (0, llm_summary_service_1.resolveChatCompletionsUrl)(p.endpoint)));
        if (stepUid != null && stepUid > 0) {
            const match = httpLlm.find((p) => p.uid === stepUid);
            if (match)
                return match;
        }
        return httpLlm[0] ?? null;
    }
    async markNotifyFail(row, error) {
        const attempts = Number(row.notify_attempts ?? 0) + 1;
        if (attempts >= MAX_NOTIFY_ATTEMPTS) {
            await row.update({
                notify_status: 'failed',
                notify_attempts: attempts,
                notify_error: String(error).slice(0, 2000),
                scan_locked_until: null,
            });
            return;
        }
        await row.update({
            notify_status: 'pending',
            notify_attempts: attempts,
            notify_error: String(error).slice(0, 2000),
            next_notify_at: new Date(Date.now() + NOTIFY_BACKOFF_MS[attempts - 1]),
            scan_locked_until: null,
        });
    }
    async markTranscriptFail(row) {
        const attempts = Number(row.transcript_attempts ?? 0) + 1;
        if (attempts >= MAX_TRANSCRIPT_ATTEMPTS) {
            await row.update({
                transcript_status: 'failed',
                transcript_attempts: attempts,
            });
            return;
        }
        await row.update({
            transcript_status: 'pending',
            transcript_attempts: attempts,
        });
    }
};
exports.VoicemailScannerService = VoicemailScannerService;
__decorate([
    (0, schedule_1.Interval)('vm-scan', SCAN_INTERVAL_MS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VoicemailScannerService.prototype, "tick", null);
exports.VoicemailScannerService = VoicemailScannerService = VoicemailScannerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(voicemail_message_model_1.VoicemailMessage)),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => voicemail_service_1.VoicemailService))),
    __param(2, (0, common_1.Optional)()),
    __param(3, (0, common_1.Optional)()),
    __param(4, (0, common_1.Optional)()),
    __param(5, (0, common_1.Optional)()),
    __param(6, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, voicemail_service_1.VoicemailService,
        stt_engines_service_1.SttEnginesService,
        provider_factory_1.SttProviderFactory,
        llm_summary_service_1.LlmSummaryService,
        ai_providers_service_1.AiProvidersService,
        system_settings_service_1.SystemSettingsService])
], VoicemailScannerService);
//# sourceMappingURL=voicemail-scanner.service.js.map