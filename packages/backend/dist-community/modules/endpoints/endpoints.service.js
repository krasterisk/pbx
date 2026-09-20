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
var EndpointsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndpointsService = exports.NAT_ENDPOINT_DEFAULTS = exports.WEBRTC_ENDPOINT_DEFAULTS = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const sequelize_2 = require("sequelize");
const crypto = __importStar(require("crypto"));
const ps_endpoint_model_1 = require("./ps-endpoint.model");
const ps_auth_model_1 = require("./ps-auth.model");
const ps_aor_model_1 = require("./ps-aor.model");
const ps_contact_model_1 = require("./ps-contact.model");
const contexts_service_1 = require("../contexts/contexts.service");
const logger_service_1 = require("../logger/logger.service");
const redis_module_1 = require("../redis/redis.module");
const conference_dialplan_util_1 = require("../conferences/conference-dialplan.util");
const endpoint_ids_util_1 = require("./endpoint-ids.util");
/** NAT profile presets that auto-configure multiple PJSIP parameters */
const NAT_PROFILES = {
    lan: {
        direct_media: 'yes',
        force_rport: 'no',
        rewrite_contact: 'no',
        rtp_symmetric: 'no',
        ice_support: 'no',
    },
    nat: {
        direct_media: 'no',
        force_rport: 'yes',
        rewrite_contact: 'yes',
        rtp_symmetric: 'yes',
        ice_support: 'yes',
    },
    webrtc: {
        direct_media: 'no',
        force_rport: 'yes',
        rewrite_contact: 'yes',
        rtp_symmetric: 'yes',
        ice_support: 'yes',
        webrtc: 'yes',
        dtls_auto_generate_cert: 'yes',
        media_encryption: 'dtls',
        rtcp_mux: 'yes',
        bundle: 'yes',
        max_video_streams: 16,
    },
};
exports.WEBRTC_ENDPOINT_DEFAULTS = NAT_PROFILES.webrtc;
exports.NAT_ENDPOINT_DEFAULTS = NAT_PROFILES.nat;
const BULK_JOB_REDIS_PREFIX = 'endpoint-bulk-job:';
const BULK_JOB_REDIS_TTL_SEC = 86400;
const BULK_SYNC_THRESHOLD = 500;
let EndpointsService = class EndpointsService {
    static { EndpointsService_1 = this; }
    endpointModel;
    authModel;
    aorModel;
    contactModel;
    sequelize;
    contextsService;
    loggerService;
    redis;
    activeJobs = new Map();
    constructor(endpointModel, authModel, aorModel, contactModel, sequelize, contextsService, loggerService, redis) {
        this.endpointModel = endpointModel;
        this.authModel = authModel;
        this.aorModel = aorModel;
        this.contactModel = contactModel;
        this.sequelize = sequelize;
        this.contextsService = contextsService;
        this.loggerService = loggerService;
        this.redis = redis;
    }
    /** Build default context name for a tenant */
    buildDefaultContext(_vpbxUserUid) {
        return 'from-internal';
    }
    /**
     * Build context with tenant ID suffix.
     * e.g. context='sip-out', tenantId=0 → 'sip-out0'
     * Falls back to default context if context is null/undefined.
     */
    buildContext(context, vpbxUserUid) {
        const base = context || this.buildDefaultContext(vpbxUserUid);
        const suffix = String(vpbxUserUid);
        // If context already ends with the tenant ID, don't duplicate
        if (base.endsWith(suffix))
            return base;
        return `${base}${suffix}`;
    }
    /** Generate a cryptographically secure random password */
    generatePassword(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
        const bytes = crypto.randomBytes(length);
        return Array.from(bytes, (b) => chars[b % chars.length]).join('');
    }
    /**
     * Public SIP credential generator — one source for the interface and the agent.
     * Uses the same crypto.randomBytes alphabet as generatePassword.
     */
    generateSipPassword(length = 16) {
        return this.generatePassword(length);
    }
    async createEphemeralGuestEndpoint(params) {
        await this.authModel.create({
            id: params.sipId,
            auth_type: 'userpass',
            username: params.sipId,
            password: params.password,
        });
        await this.aorModel.create({
            id: params.sipId,
            max_contacts: 1,
            qualify_frequency: 60,
            remove_existing: 'yes',
        });
        await this.endpointModel.create({
            id: params.sipId,
            tenantid: String(params.vpbx),
            auth: params.sipId,
            aors: params.sipId,
            context: params.context,
            callerid: null,
            disallow: 'all',
            allow: conference_dialplan_util_1.CONFERENCE_PLATFORM_CODECS.join(','),
            transport: 'transport-wss',
            dtmf_mode: 'auto',
            ...NAT_PROFILES.webrtc,
            max_video_streams: params.maxVideoStreams,
        });
    }
    async destroyEphemeralGuestEndpoint(sipId, vpbx) {
        await this.contactModel.destroy({ where: { endpoint: sipId } });
        await this.endpointModel.destroy({ where: { id: sipId, tenantid: String(vpbx) } });
        await this.authModel.destroy({ where: { id: sipId } });
        await this.aorModel.destroy({ where: { id: sipId } });
    }
    /**
     * One-shot / idempotent lift of existing WebRTC companions (ew*) to 16 video streams + VP8.
     * Primary e* rows are outside the LIKE 'ew%' selection (D-23).
     */
    async backfillWebrtcVideo() {
        const rows = await this.endpointModel.findAll({
            where: { id: { [sequelize_2.Op.like]: 'ew%' } },
        });
        for (const row of rows) {
            const patch = {};
            if (row.max_video_streams == null || row.max_video_streams < 16) {
                patch.max_video_streams = 16;
            }
            const currentAllow = String(row.allow ?? '');
            const tokens = currentAllow
                .split(',')
                .map((part) => part.trim().toLowerCase())
                .filter(Boolean);
            if (!tokens.includes('vp8')) {
                const trimmed = currentAllow.trim();
                patch.allow = trimmed ? `${trimmed},vp8` : 'vp8';
            }
            if (Object.keys(patch).length > 0) {
                await row.update(patch);
            }
        }
    }
    /**
     * Create a subscriber, generating a SIP password when missing or weak.
     * Returns the created row without the secret so agent transcripts cannot leak it.
     */
    async createWithGeneratedCredentials(dto, vpbxUserUid, userId) {
        const password = this.needsGeneratedPassword(dto.password)
            ? this.generateSipPassword()
            : dto.password;
        const created = await this.create({ ...dto, password }, vpbxUserUid, userId);
        return this.omitSecret(created);
    }
    needsGeneratedPassword(raw) {
        if (!raw || raw.length < 6)
            return true;
        return EndpointsService_1.WEAK_SIP_PASSWORDS.has(raw.toLowerCase());
    }
    omitSecret(row) {
        const { password: _password, ...rest } = row;
        return rest;
    }
    static WEAK_SIP_PASSWORDS = new Set([
        'defaultpassword',
        'password',
        '1234',
        '12345',
        '123456',
        'pass',
        'qwerty',
        'sip',
        '',
    ]);
    resolvePrimaryNatProfile(natProfile) {
        // WebRTC profile must not land on the primary (desk-phone) endpoint
        if (!natProfile || natProfile === 'webrtc')
            return NAT_PROFILES.nat;
        return NAT_PROFILES[natProfile] || NAT_PROFILES.nat;
    }
    async createCompanionTriple(vpbxUserUid, extension, primary, transaction) {
        const webrtcId = (0, endpoint_ids_util_1.buildWebrtcSipId)(vpbxUserUid, extension);
        const existing = await this.endpointModel.findByPk(webrtcId, { transaction });
        if (existing)
            return webrtcId;
        const password = this.generatePassword();
        await this.authModel.create({
            id: webrtcId,
            auth_type: 'userpass',
            username: webrtcId,
            password,
        }, { transaction });
        await this.aorModel.create({
            id: webrtcId,
            max_contacts: 1,
            qualify_frequency: 60,
            remove_existing: 'yes',
        }, { transaction });
        await this.endpointModel.create({
            id: webrtcId,
            tenantid: String(vpbxUserUid),
            auth: webrtcId,
            aors: webrtcId,
            context: primary.context,
            callerid: primary.callerid,
            disallow: 'all',
            allow: primary.allow || conference_dialplan_util_1.CONFERENCE_PLATFORM_CODECS.join(','),
            transport: 'transport-wss',
            dtmf_mode: 'auto',
            language: primary.language || 'ru',
            department: primary.department || '',
            ...NAT_PROFILES.webrtc,
        }, { transaction });
        return webrtcId;
    }
    async destroyEndpointTriple(sipId, transaction) {
        await this.contactModel.destroy({ where: { endpoint: sipId }, transaction });
        await this.endpointModel.destroy({ where: { id: sipId }, transaction });
        await this.authModel.destroy({ where: { id: sipId }, transaction });
        await this.aorModel.destroy({ where: { id: sipId }, transaction });
    }
    contactStatus(contact, aorDefaultExpiration) {
        const now = Math.floor(Date.now() / 1000);
        let lastRegistered = null;
        if (contact?.updatedAt) {
            lastRegistered = Math.floor(new Date(contact.updatedAt).getTime() / 1000);
        }
        else if (contact?.expiration_time) {
            const regInterval = aorDefaultExpiration || 3600;
            lastRegistered = contact.expiration_time - regInterval;
        }
        return {
            status: contact && contact.expiration_time > now ? 'online' : 'offline',
            userAgent: contact?.user_agent || null,
            clientIp: contact?.via_addr || null,
            contactUri: contact?.uri || null,
            lastRegistered,
        };
    }
    /** Numeric-aware extension sort: 114 < 1139 < 1140 */
    compareExtensions(a, b) {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        const aIsNum = !isNaN(numA) && String(numA) === a;
        const bIsNum = !isNaN(numB) && String(numB) === b;
        if (aIsNum && bIsNum)
            return numA - numB;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }
    /**
     * Strip tenant ID suffix from context for display.
     * e.g. 'sip-out0' with tenantId=0 → 'sip-out'
     */
    stripContext(context, vpbxUserUid) {
        if (!context)
            return '';
        const suffix = String(vpbxUserUid);
        if (context.endsWith(suffix)) {
            return context.slice(0, -suffix.length);
        }
        return context;
    }
    async persistJob(job) {
        this.activeJobs.set(job.id, job);
        await this.redis.set(`${BULK_JOB_REDIS_PREFIX}${job.id}`, JSON.stringify(job), 'EX', BULK_JOB_REDIS_TTL_SEC);
    }
    async resolveJob(jobId) {
        const cached = this.activeJobs.get(jobId);
        if (cached)
            return cached;
        const raw = await this.redis.get(`${BULK_JOB_REDIS_PREFIX}${jobId}`);
        if (!raw)
            return undefined;
        try {
            const job = JSON.parse(raw);
            this.activeJobs.set(jobId, job);
            return job;
        }
        catch {
            return undefined;
        }
    }
    /**
     * Get all endpoints for a tenant, enriched with registration status.
     * WebRTC companions (ew*) are hidden; status is attached to the primary row.
     */
    async findAll(vpbxUserUid) {
        const endpoints = await this.endpointModel.findAll({
            where: { tenantid: String(vpbxUserUid) },
        });
        const primaryEndpoints = endpoints.filter((e) => !(0, endpoint_ids_util_1.isWebrtcCompanion)(e.id));
        const companionByPrimary = new Map();
        for (const ep of endpoints) {
            if (!(0, endpoint_ids_util_1.isWebrtcCompanion)(ep.id))
                continue;
            const primaryId = (0, endpoint_ids_util_1.primaryIdOf)(ep.id);
            if (primaryId)
                companionByPrimary.set(primaryId, ep.id);
        }
        const companionIds = [...companionByPrimary.values()];
        const sipIds = [...primaryEndpoints.map((e) => e.id), ...companionIds];
        const contacts = sipIds.length
            ? await this.contactModel.findAll({
                where: { endpoint: { [sequelize_2.Op.in]: sipIds } },
            })
            : [];
        const contactMap = new Map();
        contacts.forEach((c) => {
            if (c.endpoint)
                contactMap.set(c.endpoint, c);
        });
        const auths = sipIds.length
            ? await this.authModel.findAll({
                where: { id: { [sequelize_2.Op.in]: primaryEndpoints.map((e) => e.id) } },
                attributes: ['id', 'username', 'auth_type'],
            })
            : [];
        const aors = sipIds.length
            ? await this.aorModel.findAll({
                where: { id: { [sequelize_2.Op.in]: sipIds } },
                attributes: ['id', 'default_expiration', 'qualify_frequency'],
            })
            : [];
        const authMap = new Map();
        auths.forEach((a) => authMap.set(a.id, a));
        const aorMap = new Map();
        aors.forEach((a) => aorMap.set(a.id, a));
        return primaryEndpoints
            .map((ep) => {
            const contact = contactMap.get(ep.id);
            const auth = authMap.get(ep.id);
            const aor = aorMap.get(ep.id);
            const epJson = ep.toJSON();
            const statusInfo = this.contactStatus(contact, aor?.default_expiration);
            const webrtcId = companionByPrimary.get(ep.id) || null;
            let webrtc = null;
            if (webrtcId) {
                const wContact = contactMap.get(webrtcId);
                const wAor = aorMap.get(webrtcId);
                const wStatus = this.contactStatus(wContact, wAor?.default_expiration);
                webrtc = {
                    id: webrtcId,
                    status: wStatus.status,
                    userAgent: wStatus.userAgent,
                };
            }
            return {
                ...epJson,
                webrtc_enabled: !!webrtcId,
                context: this.stripContext(epJson.context, vpbxUserUid),
                extension: (0, endpoint_ids_util_1.extractExtension)(ep.id),
                sipUsername: ep.id,
                authType: auth?.auth_type || 'userpass',
                ...statusInfo,
                webrtc,
            };
        })
            .sort((a, b) => this.compareExtensions(a.extension, b.extension));
    }
    /**
     * Get a single endpoint with full details (including AoR and Auth)
     */
    async findOne(sipId, vpbxUserUid) {
        if ((0, endpoint_ids_util_1.isWebrtcCompanion)(sipId)) {
            throw new common_1.BadRequestException('Edit the primary endpoint; WebRTC companion is managed automatically');
        }
        const endpoint = await this.endpointModel.findOne({
            where: { id: sipId, tenantid: String(vpbxUserUid) },
        });
        if (!endpoint)
            throw new common_1.NotFoundException('Endpoint not found');
        const auth = await this.authModel.findByPk(sipId);
        const aor = await this.aorModel.findByPk(sipId);
        const contact = await this.contactModel.findOne({ where: { endpoint: sipId } });
        const statusInfo = this.contactStatus(contact, aor?.default_expiration);
        const epJson = endpoint.toJSON();
        const webrtcId = (0, endpoint_ids_util_1.companionIdOf)(sipId);
        const companion = webrtcId
            ? await this.endpointModel.findByPk(webrtcId)
            : null;
        let webrtc = null;
        if (companion && webrtcId) {
            const wContact = await this.contactModel.findOne({ where: { endpoint: webrtcId } });
            const wAor = await this.aorModel.findByPk(webrtcId);
            const wStatus = this.contactStatus(wContact, wAor?.default_expiration);
            webrtc = { id: webrtcId, status: wStatus.status, userAgent: wStatus.userAgent };
        }
        return {
            endpoint: {
                ...epJson,
                webrtc_enabled: !!companion,
                context: this.stripContext(epJson.context, vpbxUserUid),
            },
            auth: auth ? { ...auth.toJSON(), password: '********' } : null,
            aor: aor?.toJSON() || null,
            extension: (0, endpoint_ids_util_1.extractExtension)(sipId),
            sipUsername: sipId,
            ...statusInfo,
            webrtc,
        };
    }
    /**
     * Get SIP credentials (username + password) for phone provisioning.
     * For primary with WebRTC companion — also returns webrtc credentials.
     */
    async getCredentials(sipId, vpbxUserUid) {
        const endpoint = await this.endpointModel.findOne({
            where: { id: sipId, tenantid: String(vpbxUserUid) },
        });
        if (!endpoint)
            throw new common_1.NotFoundException('Endpoint not found');
        const domain = process.env.SIP_DOMAIN || process.env.DB_HOST || 'localhost';
        const auth = await this.authModel.findByPk(sipId);
        const base = {
            sipId,
            extension: (0, endpoint_ids_util_1.extractExtension)(sipId),
            username: auth?.username || sipId,
            password: auth?.password || '',
            authType: auth?.auth_type || 'userpass',
            domain,
        };
        if ((0, endpoint_ids_util_1.isWebrtcCompanion)(sipId)) {
            return base;
        }
        const webrtcId = (0, endpoint_ids_util_1.companionIdOf)(sipId);
        if (!webrtcId)
            return base;
        const wAuth = await this.authModel.findByPk(webrtcId);
        if (!wAuth)
            return base;
        return {
            ...base,
            webrtc: {
                sipId: webrtcId,
                extension: (0, endpoint_ids_util_1.extractExtension)(webrtcId),
                username: wAuth.username || webrtcId,
                password: wAuth.password || '',
                authType: wAuth.auth_type || 'userpass',
                domain,
                transport: 'wss',
            },
        };
    }
    /**
     * Create a single endpoint (atomically creates ps_auths + ps_aors + ps_endpoints).
     * Optionally creates a WebRTC companion (ew*) when webrtcEnabled is true.
     */
    async create(dto, vpbxUserUid, userId) {
        const sipId = (0, endpoint_ids_util_1.buildSipId)(vpbxUserUid, dto.extension);
        const webrtcEnabled = dto.webrtcEnabled === true;
        // Check uniqueness
        const exists = await this.endpointModel.findByPk(sipId);
        if (exists)
            throw new common_1.ConflictException(`Extension ${dto.extension} already exists`);
        const context = this.buildContext(dto.context, vpbxUserUid);
        const natSettings = this.resolvePrimaryNatProfile(dto.natProfile);
        const callerid = dto.displayName
            ? `"${dto.displayName}" <${dto.extension}>`
            : `"${dto.extension}" <${dto.extension}>`;
        const allow = dto.codecs || 'ulaw,alaw,g722';
        const result = await this.sequelize.transaction(async (t) => {
            await this.authModel.create({
                id: sipId,
                auth_type: 'userpass',
                username: sipId,
                password: dto.password,
            }, { transaction: t });
            await this.aorModel.create({
                id: sipId,
                max_contacts: 1,
                qualify_frequency: 60,
                remove_existing: 'yes',
            }, { transaction: t });
            const endpoint = await this.endpointModel.create({
                id: sipId,
                tenantid: String(vpbxUserUid),
                auth: sipId,
                aors: sipId,
                context,
                callerid,
                disallow: 'all',
                allow,
                transport: dto.transport || null,
                dtmf_mode: 'auto',
                language: 'ru',
                department: dto.department || '',
                named_call_group: dto.namedCallGroup || '',
                named_pickup_group: dto.namedPickupGroup || '',
                provision_enabled: dto.provisionEnabled ? 1 : 0,
                mac_address: dto.macAddress || '',
                provision_template_id: dto.provisionTemplateId || null,
                pv_vars: dto.pvVars || '',
                ...natSettings,
                ...(dto.advanced || {}),
            }, { transaction: t });
            if (webrtcEnabled) {
                await this.createCompanionTriple(vpbxUserUid, dto.extension, { context, callerid, department: dto.department || '', language: 'ru', allow }, t);
            }
            return endpoint;
        });
        if (userId) {
            await this.loggerService.logAction(userId, 'create', 'endpoint', null, vpbxUserUid, `Created endpoint ${dto.extension} (${sipId})${webrtcEnabled ? ' + WebRTC companion' : ''}`);
        }
        return {
            ...result.toJSON(),
            extension: dto.extension,
            sipUsername: sipId,
            webrtc_enabled: webrtcEnabled,
        };
    }
    /**
     * Bulk-create a range of endpoints (e.g., 100-150)
     */
    async bulkCreate(dto, vpbxUserUid, userId) {
        const parsedExtensions = new Set();
        const parts = (dto.extensionsPattern || '').split(',').map(p => p.trim());
        for (const part of parts) {
            if (!part)
                continue;
            if (part.includes('-')) {
                const [startStr, endStr] = part.split('-');
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                if (!isNaN(start) && !isNaN(end) && start <= end && end - start <= 5000) {
                    for (let i = start; i <= end; i++) {
                        parsedExtensions.add(i);
                    }
                }
            }
            else {
                const num = parseInt(part, 10);
                if (!isNaN(num)) {
                    parsedExtensions.add(num);
                }
            }
        }
        const extensionsArray = Array.from(parsedExtensions).sort((a, b) => a - b);
        if (extensionsArray.length === 0) {
            throw new common_1.ConflictException('Invalid pattern or empty extensions array.');
        }
        await this.contextsService.ensureDefaults(vpbxUserUid);
        if (extensionsArray.length <= BULK_SYNC_THRESHOLD) {
            // Sync processing with internal chunking to avoid transaction timeouts
            const created = [];
            const skipped = [];
            const chunkSize = 50;
            for (let i = 0; i < extensionsArray.length; i += chunkSize) {
                const chunk = extensionsArray.slice(i, i + chunkSize);
                await this.processBulkChunk(chunk, dto, vpbxUserUid, created, skipped);
            }
            if (userId) {
                await this.loggerService.logAction(userId, 'bulk_create', 'endpoint', null, vpbxUserUid, `Bulk created ${created.length} endpoints (${dto.extensionsPattern}), skipped ${skipped.length} sync`);
            }
            return { created, skipped, total: created.length };
        }
        else {
            // Async processing > 200
            const jobId = crypto.randomUUID();
            const job = {
                id: jobId,
                tenantId: String(vpbxUserUid),
                total: extensionsArray.length,
                processed: 0,
                created: [],
                skipped: [],
                status: 'pending',
            };
            await this.persistJob(job);
            // Kick off background job without awaiting
            setImmediate(() => this.runBackgroundBulkJob(jobId, extensionsArray, dto, vpbxUserUid, userId));
            return { jobId, total: extensionsArray.length, message: 'Job started in background' };
        }
    }
    async getBulkJobStatus(jobId, userUid) {
        const job = await this.resolveJob(jobId);
        if (!job || job.tenantId !== String(userUid)) {
            throw new common_1.NotFoundException('Job not found');
        }
        return job;
    }
    getActiveBulkJob(vpbxUserUid) {
        const tenantStr = String(vpbxUserUid);
        for (const [id, job] of this.activeJobs.entries()) {
            if (job.tenantId === tenantStr && (job.status === 'pending' || job.status === 'processing')) {
                return { jobId: id };
            }
        }
        return { jobId: null };
    }
    async runBackgroundBulkJob(jobId, extensionsArray, dto, vpbxUserUid, userId) {
        const job = this.activeJobs.get(jobId);
        if (!job)
            return;
        job.status = 'processing';
        await this.persistJob(job);
        const chunkSize = 50;
        try {
            for (let i = 0; i < extensionsArray.length; i += chunkSize) {
                const chunk = extensionsArray.slice(i, i + chunkSize);
                await this.processBulkChunk(chunk, dto, vpbxUserUid, job.created, job.skipped);
                job.processed += chunk.length;
                await this.persistJob(job);
            }
            job.status = 'completed';
            await this.persistJob(job);
            if (userId) {
                await this.loggerService.logAction(userId, 'bulk_create', 'endpoint', null, vpbxUserUid, `Async Bulk created ${job.created.length} endpoints (${dto.extensionsPattern}), skipped ${job.skipped.length}`);
            }
        }
        catch (error) {
            this.loggerService.logAction(userId || 0, 'bulk_create_error', 'endpoint', null, vpbxUserUid, `Async Bulk failed: ${error.message}`);
            job.status = 'error';
            job.error = error.message;
            await this.persistJob(job);
        }
        finally {
            // Drop from in-memory cache after 1 hour; Redis keeps status for 24h
            setTimeout(() => {
                this.activeJobs.delete(jobId);
            }, 3600_000);
        }
    }
    async processBulkChunk(chunk, dto, vpbxUserUid, createdDest, skippedDest) {
        const context = this.buildContext(dto.context, vpbxUserUid);
        const natSettings = this.resolvePrimaryNatProfile(dto.natProfile);
        const webrtcEnabled = dto.webrtcEnabled === true;
        const allow = dto.codecs || 'ulaw,alaw,g722';
        await this.sequelize.transaction(async (t) => {
            for (const ext of chunk) {
                const extension = String(ext);
                const sipId = (0, endpoint_ids_util_1.buildSipId)(vpbxUserUid, extension);
                const exists = await this.endpointModel.findByPk(sipId, { transaction: t });
                if (exists) {
                    skippedDest.push(extension);
                    continue;
                }
                const password = dto.passwordPattern === 'auto' ? this.generatePassword() : dto.passwordPattern;
                const displayName = dto.displayNamePattern
                    ? dto.displayNamePattern.replace('{N}', extension)
                    : extension;
                const callerid = `"${displayName}" <${extension}>`;
                await this.authModel.create({ id: sipId, auth_type: 'userpass', username: sipId, password }, { transaction: t });
                await this.aorModel.create({ id: sipId, max_contacts: 1, qualify_frequency: 60, remove_existing: 'yes' }, { transaction: t });
                await this.endpointModel.create({
                    id: sipId,
                    tenantid: String(vpbxUserUid),
                    auth: sipId,
                    aors: sipId,
                    context,
                    callerid,
                    disallow: 'all',
                    allow,
                    transport: dto.transport || null,
                    dtmf_mode: 'auto',
                    language: 'ru',
                    department: dto.department || '',
                    ...natSettings,
                }, { transaction: t });
                if (webrtcEnabled) {
                    await this.createCompanionTriple(vpbxUserUid, extension, { context, callerid, department: dto.department || '', language: 'ru', allow }, t);
                }
                createdDest.push(extension);
            }
        });
    }
    /**
     * Update an endpoint (and optionally its auth/aor).
     * Handles webrtc_enabled toggle: create/destroy companion; syncs fields to companion.
     */
    async update(sipId, data, vpbxUserUid, userId) {
        if ((0, endpoint_ids_util_1.isWebrtcCompanion)(sipId)) {
            throw new common_1.BadRequestException('Edit the primary endpoint; WebRTC companion is managed automatically');
        }
        const existing = await this.endpointModel.findOne({
            where: { id: sipId, tenantid: String(vpbxUserUid) },
        });
        if (!existing)
            throw new common_1.NotFoundException('Endpoint not found');
        const extension = (0, endpoint_ids_util_1.extractExtension)(sipId);
        const webrtcId = (0, endpoint_ids_util_1.companionIdOf)(sipId);
        const existingCompanion = webrtcId
            ? await this.endpointModel.findByPk(webrtcId)
            : null;
        const wasEnabled = !!existingCompanion;
        await this.sequelize.transaction(async (t) => {
            const epPatch = data.endpoint ? { ...data.endpoint } : undefined;
            let nextWebrtcEnabled = wasEnabled;
            if (epPatch && typeof epPatch.webrtc_enabled === 'boolean') {
                nextWebrtcEnabled = epPatch.webrtc_enabled;
                delete epPatch.webrtc_enabled; // not a DB column — derived from companion
            }
            if (epPatch) {
                if (epPatch.context) {
                    epPatch.context = this.buildContext(epPatch.context, vpbxUserUid);
                }
                // Never put WebRTC media profile on the primary via raw patch
                if (epPatch.webrtc === 'yes') {
                    delete epPatch.webrtc;
                    delete epPatch.dtls_auto_generate_cert;
                    delete epPatch.media_encryption;
                    delete epPatch.rtcp_mux;
                    delete epPatch.bundle;
                }
                await this.endpointModel.update(epPatch, {
                    where: { id: sipId },
                    transaction: t,
                });
            }
            if (data.auth) {
                await this.authModel.update(data.auth, {
                    where: { id: sipId },
                    transaction: t,
                });
            }
            if (data.aor) {
                await this.aorModel.update(data.aor, {
                    where: { id: sipId },
                    transaction: t,
                });
            }
            if (!wasEnabled && nextWebrtcEnabled && webrtcId) {
                const refreshed = await this.endpointModel.findByPk(sipId, { transaction: t });
                await this.createCompanionTriple(vpbxUserUid, extension, {
                    context: refreshed?.context || existing.context,
                    callerid: refreshed?.callerid ?? existing.callerid,
                    department: refreshed?.department ?? existing.department,
                    language: refreshed?.language ?? existing.language,
                    allow: refreshed?.allow ?? existing.allow,
                }, t);
            }
            else if (wasEnabled && !nextWebrtcEnabled && webrtcId) {
                await this.destroyEndpointTriple(webrtcId, t);
            }
            else if (nextWebrtcEnabled && webrtcId) {
                // Sync shared fields to companion
                const sync = {};
                if (epPatch?.callerid !== undefined)
                    sync.callerid = epPatch.callerid;
                if (epPatch?.context !== undefined)
                    sync.context = epPatch.context;
                if (epPatch?.department !== undefined)
                    sync.department = epPatch.department;
                if (epPatch?.language !== undefined)
                    sync.language = epPatch.language;
                if (epPatch?.allow !== undefined)
                    sync.allow = epPatch.allow;
                if (Object.keys(sync).length) {
                    await this.endpointModel.update(sync, {
                        where: { id: webrtcId },
                        transaction: t,
                    });
                }
            }
        });
        if (userId) {
            await this.loggerService.logAction(userId, 'update', 'endpoint', null, vpbxUserUid, `Updated endpoint ${extension} (${sipId})`);
        }
        return this.findOne(sipId, vpbxUserUid);
    }
    /**
     * Delete an endpoint (removes primary + WebRTC companion if present)
     */
    async remove(sipId, vpbxUserUid, userId) {
        if ((0, endpoint_ids_util_1.isWebrtcCompanion)(sipId)) {
            throw new common_1.BadRequestException('Delete the primary endpoint; WebRTC companion is removed with it');
        }
        const existing = await this.endpointModel.findOne({
            where: { id: sipId, tenantid: String(vpbxUserUid) },
        });
        if (!existing)
            throw new common_1.NotFoundException('Endpoint not found');
        const webrtcId = (0, endpoint_ids_util_1.companionIdOf)(sipId);
        await this.sequelize.transaction(async (t) => {
            if (webrtcId) {
                await this.destroyEndpointTriple(webrtcId, t);
            }
            await this.destroyEndpointTriple(sipId, t);
        });
        if (userId) {
            await this.loggerService.logAction(userId, 'delete', 'endpoint', null, vpbxUserUid, `Deleted endpoint ${(0, endpoint_ids_util_1.extractExtension)(sipId)} (${sipId})`);
        }
    }
    /**
     * Bulk-delete multiple endpoints atomically (includes WebRTC companions)
     */
    async bulkRemove(sipIds, vpbxUserUid, userId) {
        const primaryIds = sipIds.filter((id) => !(0, endpoint_ids_util_1.isWebrtcCompanion)(id));
        const endpoints = await this.endpointModel.findAll({
            where: { id: { [sequelize_2.Op.in]: primaryIds }, tenantid: String(vpbxUserUid) },
        });
        const validIds = endpoints.map((e) => e.id);
        if (validIds.length === 0)
            throw new common_1.NotFoundException('No matching endpoints found');
        const companionIds = validIds
            .map((id) => (0, endpoint_ids_util_1.companionIdOf)(id))
            .filter((id) => !!id);
        const allIds = [...validIds, ...companionIds];
        await this.sequelize.transaction(async (t) => {
            await this.contactModel.destroy({ where: { endpoint: { [sequelize_2.Op.in]: allIds } }, transaction: t });
            await this.endpointModel.destroy({ where: { id: { [sequelize_2.Op.in]: allIds } }, transaction: t });
            await this.authModel.destroy({ where: { id: { [sequelize_2.Op.in]: allIds } }, transaction: t });
            await this.aorModel.destroy({ where: { id: { [sequelize_2.Op.in]: allIds } }, transaction: t });
        });
        if (userId) {
            const extensions = validIds.map((id) => (0, endpoint_ids_util_1.extractExtension)(id)).join(', ');
            await this.loggerService.logAction(userId, 'bulk_delete', 'endpoint', null, vpbxUserUid, `Bulk deleted ${validIds.length} endpoints: ${extensions}`);
        }
        return { deleted: validIds.length, ids: validIds };
    }
    /** Extensions that have a WebRTC companion (ew*) — for dialplan generation */
    async listWebrtcEnabledExtensions(vpbxUserUid) {
        const rows = await this.endpointModel.findAll({
            where: {
                tenantid: String(vpbxUserUid),
                id: { [sequelize_2.Op.like]: 'ew%' },
            },
            attributes: ['id'],
        });
        return new Set(rows.map((r) => (0, endpoint_ids_util_1.extractExtension)(r.id)));
    }
};
exports.EndpointsService = EndpointsService;
exports.EndpointsService = EndpointsService = EndpointsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ps_endpoint_model_1.PsEndpoint)),
    __param(1, (0, sequelize_1.InjectModel)(ps_auth_model_1.PsAuth)),
    __param(2, (0, sequelize_1.InjectModel)(ps_aor_model_1.PsAor)),
    __param(3, (0, sequelize_1.InjectModel)(ps_contact_model_1.PsContact)),
    __param(7, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, sequelize_typescript_1.Sequelize,
        contexts_service_1.ContextsService,
        logger_service_1.LoggerService, Object])
], EndpointsService);
//# sourceMappingURL=endpoints.service.js.map