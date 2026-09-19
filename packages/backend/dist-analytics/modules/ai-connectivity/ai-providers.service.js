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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiProvidersService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ai_provider_model_1 = require("./ai-provider.model");
const secret_cipher_util_1 = require("./secret-cipher.util");
const chat_endpoint_util_1 = require("./chat-endpoint.util");
const PROVIDER_CAPABILITIES = new Set(['llm', 'stt', 'tts', 'realtime', 'tools', 'function_calling']);
/**
 * Tenant-owned LLM (and voice) provider connections.
 * Global templates are not used — each tenant creates their own rows.
 */
let AiProvidersService = class AiProvidersService {
    model;
    constructor(model) {
        this.model = model;
    }
    /**
     * Chat-completions provider for this tenant.
     * Preferred uid wins when it belongs to the tenant and is a usable LLM.
     */
    async findDefaultLlm(tenantUid, preferredUid) {
        const selected = Number(preferredUid);
        if (Number.isFinite(selected) && selected > 0) {
            const chosen = await this.model.findOne({
                where: { uid: selected, user_uid: tenantUid, enabled: true },
            });
            if (chosen && chosen.user_uid === tenantUid && chosen.enabled && this.isChatLlm(chosen)) {
                return chosen;
            }
        }
        const candidates = await this.model.findAll({
            where: { user_uid: tenantUid, enabled: true },
            order: [['uid', 'ASC']],
        });
        return candidates.find((candidate) => candidate.user_uid === tenantUid
            && candidate.enabled && this.isChatLlm(candidate)) ?? null;
    }
    hasLlm(row) {
        return Array.isArray(row.capabilities) && row.capabilities.includes('llm');
    }
    isChatLlm(row) {
        return this.hasLlm(row) && !!(0, chat_endpoint_util_1.resolveChatCompletionsUrl)(row.endpoint ?? '');
    }
    /** Capture nonsecret admission facts; jobs retain a server-side credential reference. */
    async revisionForOperation(tenantUid, providerUid, capability) {
        const row = await this.usableProvider(tenantUid, providerUid, capability);
        const credentialRef = Object.freeze({ tenantUid, providerUid, capability });
        return Object.freeze({ providerUid, tenantUid, capability,
            config: Object.freeze({ kind: row.kind, vendor: row.vendor, endpoint: row.endpoint,
                authType: row.auth_type, capabilities: Object.freeze([...row.capabilities]) }),
            credentialRef });
    }
    /** Recheck tenant, enabled state and capability immediately before provider I/O. */
    async resolveCredential(reference) {
        const row = await this.usableProvider(reference.tenantUid, reference.providerUid, reference.capability);
        if (row.auth_type === 'none')
            return '';
        if (!row.encrypted_api_key)
            throw new common_1.ForbiddenException({ code: 'provider_secret_missing' });
        return (0, secret_cipher_util_1.decryptSecret)(row.encrypted_api_key);
    }
    async usableProvider(tenantUid, providerUid, capability) {
        if (!Number.isSafeInteger(tenantUid) || tenantUid < 0
            || !Number.isSafeInteger(providerUid) || providerUid <= 0
            || !PROVIDER_CAPABILITIES.has(capability)) {
            throw new common_1.NotFoundException({ code: 'provider_not_found' });
        }
        const row = await this.model.findOne({
            where: { uid: providerUid, user_uid: tenantUid, enabled: true },
        });
        if (!row || row.uid !== providerUid || row.user_uid !== tenantUid || row.enabled !== true
            || !Array.isArray(row.capabilities) || !row.capabilities.includes(capability)) {
            throw new common_1.NotFoundException({ code: 'provider_not_found' });
        }
        return row;
    }
    async findAll(userUid) {
        return this.model.findAll({
            where: { user_uid: userUid },
            order: [['name', 'ASC']],
        });
    }
    async findOne(id, userUid) {
        const row = await this.model.findOne({
            where: { uid: id, user_uid: userUid },
        });
        if (!row)
            throw new common_1.NotFoundException('Provider not found');
        return row;
    }
    async create(dto, userUid) {
        if (!dto.capabilities || dto.capabilities.length === 0) {
            throw new common_1.BadRequestException('At least one capability is required');
        }
        if (!dto.pricing) {
            throw new common_1.BadRequestException('Pricing config is required');
        }
        const encrypted_api_key = dto.apiKey ? (0, secret_cipher_util_1.encryptSecret)(dto.apiKey) : '';
        return this.model.create({
            name: dto.name,
            kind: dto.kind,
            vendor: dto.vendor,
            endpoint: dto.endpoint,
            auth_type: dto.auth_type || 'bearer',
            encrypted_api_key,
            capabilities: dto.capabilities,
            defaults: dto.defaults || {},
            pricing: dto.pricing,
            enabled: dto.enabled !== false,
            user_uid: userUid,
        });
    }
    async update(id, dto, userUid) {
        const row = await this.model.findOne({ where: { uid: id, user_uid: userUid } });
        if (!row)
            throw new common_1.NotFoundException('Provider not found');
        const patch = { ...dto };
        delete patch.apiKey;
        if (typeof dto.apiKey === 'string' && dto.apiKey.length > 0) {
            patch.encrypted_api_key = (0, secret_cipher_util_1.encryptSecret)(dto.apiKey);
        }
        else if (dto.apiKey === '') {
            patch.encrypted_api_key = '';
        }
        await row.update(patch);
        return row;
    }
    async remove(id, userUid) {
        const row = await this.model.findOne({ where: { uid: id, user_uid: userUid } });
        if (!row)
            throw new common_1.NotFoundException('Provider not found');
        await row.destroy();
        return { success: true };
    }
};
exports.AiProvidersService = AiProvidersService;
exports.AiProvidersService = AiProvidersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ai_provider_model_1.CcAiProvider)),
    __metadata("design:paramtypes", [Object])
], AiProvidersService);
//# sourceMappingURL=ai-providers.service.js.map