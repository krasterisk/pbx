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
var VoicemailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoicemailService = exports.UNIQUEID_ALLOW = exports.VOICEMAIL_ATTACH_MAX_BYTES = exports.PLAY_TOKEN_TTL_MS = void 0;
exports.sanitizeUniqueid = sanitizeUniqueid;
exports.parseTenantUid = parseTenantUid;
exports.toRelativeFileRel = toRelativeFileRel;
exports.safeVoicemailFilePath = safeVoicemailFilePath;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sequelize_1 = require("@nestjs/sequelize");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const notification_dispatcher_service_1 = require("../notifications/notification-dispatcher.service");
const notification_provider_interface_1 = require("../notifications/providers/notification-provider.interface");
const cdr_service_1 = require("../reports/cdr/cdr.service");
const system_settings_service_1 = require("../system-settings/system-settings.service");
const voicemail_access_token_model_1 = require("./voicemail-access-token.model");
const voicemail_message_model_1 = require("./voicemail-message.model");
const voicemail_scanner_service_1 = require("./voicemail-scanner.service");
exports.PLAY_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** D-64/D-65: attach iff size is strictly less than 2 MiB. */
exports.VOICEMAIL_ATTACH_MAX_BYTES = 2 * 1024 * 1024;
const FIRST_NOTIFY_RETRY_MS = 60_000;
/** Asterisk UNIQUEID / safe filename stem: digits, letters, dot, underscore, hyphen. */
exports.UNIQUEID_ALLOW = /^[A-Za-z0-9._-]{1,128}$/;
function sanitizeUniqueid(raw) {
    const value = String(raw ?? '').trim();
    if (!exports.UNIQUEID_ALLOW.test(value))
        return null;
    return value;
}
function parseTenantUid(raw) {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1)
        return null;
    return value;
}
/**
 * D-72: rebuild a relative path under `{vpbx_user_uid}/voicemail/`.
 * Never persist a caller-supplied absolute path (T-13-05).
 */
function toRelativeFileRel(userUid, uniqueid, file) {
    const escaped = uniqueid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalized = String(file ?? '').replace(/\\/g, '/');
    const match = normalized.match(new RegExp(`(${escaped}-\\d+)(?:\\.wav)?$`, 'i'));
    const name = match ? `${match[1]}.wav` : `${uniqueid}.wav`;
    return `${userUid}/voicemail/${name}`;
}
/**
 * Resolve a voicemail wav under records_base_path (T-13-12).
 * Same `..` / startsWith guards as CDR; uses the DB relative path as-is (never appends .mp3).
 */
function safeVoicemailFilePath(base, rel) {
    const cleaned = String(rel ?? '').replace(/^\/+/, '').replace(/\\/g, '/');
    if (!cleaned || cleaned.includes('..') || path.isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned)) {
        return null;
    }
    const baseResolved = path.resolve(base);
    const fileResolved = path.resolve(baseResolved, cleaned);
    const prefix = baseResolved.endsWith(path.sep) ? baseResolved : baseResolved + path.sep;
    if (fileResolved !== baseResolved && !fileResolved.startsWith(prefix))
        return null;
    return fs.existsSync(fileResolved) ? fileResolved : null;
}
let VoicemailService = VoicemailService_1 = class VoicemailService {
    messages;
    tokens;
    config;
    systemSettings;
    dispatcher;
    scanner;
    cdrService;
    logger = new common_1.Logger(VoicemailService_1.name);
    constructor(messages, tokens, config, systemSettings, dispatcher, scanner, cdrService) {
        this.messages = messages;
        this.tokens = tokens;
        this.config = config;
        this.systemSettings = systemSettings;
        this.dispatcher = dispatcher;
        this.scanner = scanner;
        this.cdrService = cdrService;
    }
    /**
     * Mint a 7-day opaque play URL for notify links (D-59 / D-67).
     * Never attached to JWT list/detail JSON.
     */
    async mintPlayToken(message) {
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        const expiresAt = new Date(Date.now() + exports.PLAY_TOKEN_TTL_MS);
        await this.tokens.create({
            token,
            message_uid: message.uid,
            vpbx_user_uid: message.user_uid,
            expires_at: expiresAt,
            revoked_at: null,
        });
        const appUrl = (this.config.get('APP_URL') ?? 'https://pbx.krasterisk.ru').replace(/\/$/, '');
        return `${appUrl}/api/voicemail/play?token=${encodeURIComponent(token)}`;
    }
    async streamByPlayToken(token, vpbxUserUid, req, res) {
        const row = await this.tokens.findOne({ where: { token } });
        if (!row || row.vpbx_user_uid !== vpbxUserUid) {
            throw new common_1.NotFoundException('Voicemail message not found');
        }
        const message = await this.messages.findOne({
            where: { uid: row.message_uid, user_uid: vpbxUserUid },
        });
        if (!message) {
            throw new common_1.NotFoundException('Voicemail message not found');
        }
        const cfg = await this.systemSettings.getServerConfigRaw();
        const basePath = cfg.records_base_path || '/usr/records';
        const filePath = safeVoicemailFilePath(basePath, message.file_rel);
        if (!filePath) {
            throw new common_1.NotFoundException('Voicemail file not found');
        }
        await this.streamWavFile(filePath, message.uniqueid, req, res);
    }
    async streamWavFile(filePath, uniqueid, req, res) {
        let fileSize;
        try {
            fileSize = (await fs.promises.stat(filePath)).size;
        }
        catch {
            throw new common_1.NotFoundException('Voicemail file not found');
        }
        const download = req?.query?.download === '1' || req?.query?.download === 'true';
        const safeName = String(uniqueid).replace(/[^\w.-]+/g, '_');
        const disposition = download
            ? `attachment; filename="${safeName}.wav"`
            : 'inline';
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Disposition', disposition);
        res.setHeader('Accept-Ranges', 'bytes');
        const rangeHeader = req?.headers?.range;
        if (rangeHeader) {
            const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
            if (!match) {
                res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
                res.end();
                return;
            }
            let start;
            let end;
            if (match[1] === '' && match[2]) {
                const suffix = parseInt(match[2], 10);
                start = Math.max(fileSize - suffix, 0);
                end = fileSize - 1;
            }
            else {
                start = match[1] ? parseInt(match[1], 10) : 0;
                end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
            }
            if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
                res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
                res.end();
                return;
            }
            end = Math.min(end, fileSize - 1);
            const chunkSize = end - start + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', chunkSize);
            const stream = fs.createReadStream(filePath, { start, end });
            stream.on('error', () => {
                if (!res.headersSent)
                    res.status(404).end();
            });
            stream.pipe(res);
            return;
        }
        res.setHeader('Content-Length', fileSize);
        const stream = fs.createReadStream(filePath);
        stream.on('error', () => {
            if (!res.headersSent)
                res.status(404).end();
        });
        stream.pipe(res);
    }
    /**
     * Hangup-handler ingest (D-60 / D-62 / D-72). Upserts the row, then first notify.
     * Does not call STT or LLM (D-60). Controller returns `{accepted:true}` before this settles.
     */
    async ingest(body) {
        const uniqueid = sanitizeUniqueid(body.uniqueid);
        if (!uniqueid) {
            this.logger.warn('voicemail ingest rejected: invalid uniqueid');
            return;
        }
        const userUid = parseTenantUid(body.vpbx_user_uid ?? body.user_uid);
        if (userUid == null) {
            this.logger.warn('voicemail ingest rejected: invalid tenant uid');
            return;
        }
        const fileRel = toRelativeFileRel(userUid, uniqueid, body.file);
        const recordStatus = String(body.status ?? '').slice(0, 32);
        const callerId = String(body.clid ?? '').slice(0, 64);
        const exten = String(body.exten ?? '').slice(0, 64);
        const durationRaw = Number(body.duration_sec);
        const durationSec = Number.isFinite(durationRaw) && durationRaw >= 0
            ? Math.trunc(durationRaw)
            : null;
        const existing = await this.messages.findOne({
            where: { user_uid: userUid, uniqueid },
        });
        const patch = {
            file_rel: fileRel,
            record_status: recordStatus,
            caller_id: callerId,
            exten,
            duration_sec: durationSec,
        };
        if (existing) {
            await existing.update(patch);
            return;
        }
        const integrationUid = parseTenantUid(body.integration_uid);
        const sttEngineUid = parseTenantUid(body.stt_engine_uid);
        const llmProviderUid = parseTenantUid(body.llm_provider_uid);
        const snapshot = {
            ...(integrationUid != null ? { integration_uid: integrationUid } : {}),
            body: body.body,
            target: body.target,
            subject: body.subject,
            clid: body.clid,
            exten: body.exten,
            ...(sttEngineUid != null ? { stt_engine_uid: sttEngineUid } : {}),
            ...(llmProviderUid != null ? { llm_provider_uid: llmProviderUid } : {}),
        };
        const notifyDispatch = (integrationUid != null || sttEngineUid != null || llmProviderUid != null)
            ? JSON.stringify(snapshot)
            : null;
        const row = await this.messages.create({
            user_uid: userUid,
            uniqueid,
            ...patch,
            notify_status: 'pending',
            transcript_status: 'pending',
            notify_attempts: 0,
            transcript_attempts: 0,
            next_notify_at: integrationUid != null ? new Date() : null,
            scan_locked_until: null,
            notify_dispatch: notifyDispatch,
        });
        await this.sendFirstNotify(row, body);
    }
    /**
     * Scanner retry (13-07). Reuses the 13-06 attach/link dispatch from the stored snapshot.
     * Throws on transport failure so the scanner owns backoff / D-68.
     */
    async retryNotify(row) {
        const ctx = this.readNotifyDispatch(row);
        if (!ctx || !this.dispatcher) {
            throw new Error('notify_dispatch_missing');
        }
        const result = await this.dispatchStoredNotify(row, ctx);
        if (!result.sent)
            throw new Error(result.error);
    }
    /**
     * First notify after insert (D-62). Byte-gated attach (D-64/D-65).
     * `attachment_rejected` same-channel link fallback does not increment attempts (D-66).
     */
    async sendFirstNotify(row, body) {
        const integrationUid = parseTenantUid(body.integration_uid);
        if (integrationUid == null || !this.dispatcher)
            return;
        try {
            const result = await this.dispatchStoredNotify(row, {
                integration_uid: integrationUid,
                body: body.body,
                target: body.target,
                subject: body.subject,
                clid: body.clid,
                exten: body.exten,
            });
            if (!result.sent) {
                await this.markNotifyTransportFail(row, result.error);
            }
        }
        catch (e) {
            this.logger.error(`voicemail first notify failed: ${e?.message ?? e}`);
            await this.markNotifyTransportFail(row, e?.message ?? 'transport_error');
        }
    }
    readNotifyDispatch(row) {
        const raw = row.notify_dispatch;
        if (!raw)
            return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed?.integration_uid ? parsed : null;
        }
        catch {
            return null;
        }
    }
    async dispatchStoredNotify(row, ctx) {
        const cfg = await this.systemSettings.getServerConfigRaw();
        const basePath = cfg.records_base_path || '/usr/records';
        const filePath = safeVoicemailFilePath(basePath, row.file_rel);
        if (!filePath) {
            return { sent: false, error: 'file_missing' };
        }
        const stat = await fs.promises.stat(filePath);
        const filename = path.posix.basename(row.file_rel.replace(/\\/g, '/')) || `${row.uniqueid}.wav`;
        if (stat.size < exports.VOICEMAIL_ATTACH_MAX_BYTES) {
            const content = await fs.promises.readFile(filePath);
            const message = this.buildNotifyBody(ctx.body, row.file_rel);
            const first = await this.dispatcher.dispatch({
                integration_uid: ctx.integration_uid,
                message,
                target: ctx.target,
                subject: ctx.subject,
                clid: ctx.clid,
                exten: ctx.exten,
                uniqueid: row.uniqueid,
                attach: { filename, content, contentType: 'audio/wav' },
            });
            if (first?.success) {
                await row.update({ notify_status: 'sent', notify_error: null });
                return { sent: true };
            }
            if (first?.error === notification_provider_interface_1.ATTACHMENT_REJECTED) {
                return this.dispatchLinkNotify(row, ctx);
            }
            return { sent: false, error: first?.error ?? 'transport_error' };
        }
        return this.dispatchLinkNotify(row, ctx);
    }
    async dispatchLinkNotify(row, ctx) {
        const playUrl = await this.mintPlayToken(row);
        const message = this.buildNotifyBody(ctx.body, row.file_rel, playUrl);
        const result = await this.dispatcher.dispatch({
            integration_uid: ctx.integration_uid,
            message,
            target: ctx.target,
            subject: ctx.subject,
            clid: ctx.clid,
            exten: ctx.exten,
            uniqueid: row.uniqueid,
        });
        if (result?.success) {
            await row.update({ notify_status: 'sent', notify_error: null });
            return { sent: true };
        }
        return { sent: false, error: result?.error ?? 'transport_error' };
    }
    buildNotifyBody(base, fileRel, playUrl) {
        const parts = [String(base ?? '').trim() || 'New voicemail', `RECORDED_FILE=${fileRel}`];
        if (playUrl)
            parts.push(playUrl);
        return parts.join('\n');
    }
    async markNotifyTransportFail(row, error) {
        await row.update({
            notify_status: 'pending',
            notify_attempts: 1,
            notify_error: String(error).slice(0, 2000),
            next_notify_at: new Date(Date.now() + FIRST_NOTIFY_RETRY_MS),
        });
    }
    async list(vpbxUserUid, viewerUserId) {
        const rows = await this.messages.findAll({
            where: { user_uid: vpbxUserUid },
            order: [['created_at', 'DESC']],
        });
        if (!this.cdrService || !viewerUserId) {
            return rows.map((row) => this.toDetailDto(row));
        }
        const visible = [];
        for (const row of rows) {
            try {
                await this.cdrService.findByUniqueid(vpbxUserUid, row.uniqueid, viewerUserId);
                visible.push(this.toDetailDto(row));
            }
            catch {
                // Same CDR access-scope as play/detail: hidden calls are omitted.
            }
        }
        return visible;
    }
    async findByUniqueid(tenantId, uniqueid, viewerUserId) {
        const row = await this.requireVisibleRow(tenantId, uniqueid, viewerUserId);
        return this.toDetailDto(row);
    }
    async streamByUniqueid(tenantId, uniqueid, res, req, viewerUserId) {
        const row = await this.requireVisibleRow(tenantId, uniqueid, viewerUserId);
        const cfg = await this.systemSettings.getServerConfigRaw();
        const basePath = cfg.records_base_path || '/usr/records';
        const filePath = safeVoicemailFilePath(basePath, row.file_rel);
        if (!filePath) {
            throw new common_1.NotFoundException('Voicemail file not found');
        }
        await this.streamWavFile(filePath, row.uniqueid, req, res);
    }
    async retryStt(tenantId, uniqueid, viewerUserId) {
        const row = await this.requireVisibleRow(tenantId, uniqueid, viewerUserId);
        if (row.transcript_status !== 'failed') {
            throw new common_1.BadRequestException('Voicemail transcript retry is only allowed when status is failed');
        }
        if (!this.scanner) {
            throw new common_1.BadRequestException('Voicemail scanner is unavailable');
        }
        await this.scanner.retryTranscript(uniqueid, tenantId);
        return { ok: true };
    }
    async requireVisibleRow(tenantId, uniqueid, viewerUserId) {
        const row = await this.messages.findOne({
            where: { user_uid: tenantId, uniqueid },
        });
        if (!row) {
            throw new common_1.NotFoundException('Voicemail message not found');
        }
        if (this.cdrService && viewerUserId) {
            await this.cdrService.findByUniqueid(tenantId, uniqueid, viewerUserId);
        }
        return row;
    }
    toDetailDto(row) {
        return {
            uid: row.uid,
            vpbx_user_uid: row.user_uid,
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
exports.VoicemailService = VoicemailService;
exports.VoicemailService = VoicemailService = VoicemailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(voicemail_message_model_1.VoicemailMessage)),
    __param(1, (0, sequelize_1.InjectModel)(voicemail_access_token_model_1.VoicemailAccessToken)),
    __param(4, (0, common_1.Optional)()),
    __param(5, (0, common_1.Optional)()),
    __param(5, (0, common_1.Inject)((0, common_1.forwardRef)(() => voicemail_scanner_service_1.VoicemailScannerService))),
    __param(6, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, Object, config_1.ConfigService,
        system_settings_service_1.SystemSettingsService,
        notification_dispatcher_service_1.NotificationDispatcherService,
        voicemail_scanner_service_1.VoicemailScannerService,
        cdr_service_1.CdrService])
], VoicemailService);
//# sourceMappingURL=voicemail.service.js.map