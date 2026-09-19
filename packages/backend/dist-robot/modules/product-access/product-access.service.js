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
exports.ProductAccessService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const tenant_model_1 = require("../cloud-admin/tenant.model");
const tenant_module_model_1 = require("../cloud-admin/tenant-module.model");
const product_access_policy_1 = require("../cloud-admin/product-access-policy");
const action_log_model_1 = require("../logger/action-log.model");
const product_activation_model_1 = require("./product-activation.model");
const local_license_document_model_1 = require("./local-license-document.model");
const local_license_binding_model_1 = require("./local-license-binding.model");
const license_verifier_1 = require("./license-verifier");
let ProductAccessService = class ProductAccessService {
    tenants;
    tenantModules;
    activations;
    documents;
    bindings;
    actionLogs;
    config;
    sequelize;
    constructor(tenants, tenantModules, activations, documents, bindings, actionLogs, config, sequelize) {
        this.tenants = tenants;
        this.tenantModules = tenantModules;
        this.activations = activations;
        this.documents = documents;
        this.bindings = bindings;
        this.actionLogs = actionLogs;
        this.config = config;
        this.sequelize = sequelize;
    }
    mode() {
        return this.config.get('DEPLOYMENT_MODE', 'BOX').toUpperCase();
    }
    trust() {
        const issuer = this.config.get('AI_LICENSE_ISSUER');
        const installationId = this.config.get('AI_LICENSE_INSTALLATION_ID');
        const raw = this.config.get('AI_LICENSE_PUBLIC_KEYS_JSON');
        if (!issuer || !installationId || !raw) {
            throw new common_1.ServiceUnavailableException({ code: 'license_trust_not_configured' });
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            throw new common_1.ServiceUnavailableException({ code: 'license_trust_not_configured' });
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
            || Object.keys(parsed).length === 0
            || Object.values(parsed).some((pem) => typeof pem !== 'string')) {
            throw new common_1.ServiceUnavailableException({ code: 'license_trust_not_configured' });
        }
        return { issuer, installationId, publicKeys: parsed };
    }
    async decide(userUid, product, now = new Date(), transaction, activationOverride) {
        if (!(0, product_access_policy_1.isAiProductCode)(product) || !Number.isSafeInteger(userUid) || userUid < 0) {
            throw new common_1.BadRequestException({ code: 'UNKNOWN_AI_PRODUCT_OR_TENANT' });
        }
        const mode = this.mode();
        const tenant = await this.tenants.findOne({
            where: { vpbx_user_uid: userUid },
            attributes: ['id', 'status', 'trial_ends_at'], transaction,
        });
        const activation = tenant ? await this.activations.findOne({
            where: { user_uid: userUid, product }, transaction,
        }) : null;
        const enabled = activationOverride ?? !!activation?.enabled;
        const grants = mode === 'CLOUD' && tenant
            ? await this.tenantModules.findAll({
                where: { tenant_id: tenant.id,
                    module_code: product === 'speech_analytics'
                        ? [product, 'cc_ai_voice'] : [product] },
                attributes: ['module_code', 'status', 'expires_at'], transaction,
            }) : [];
        let local = { grant: null, reason: 'license_invalid' };
        if (mode === 'BOX' && tenant) {
            local = await this.readBoxGrant(userUid, product, now, transaction);
        }
        return (0, product_access_policy_1.resolveProductAccess)({
            product, deploymentMode: mode, tenant, grants,
            activationEnabled: enabled, packageInstalled: mode !== 'OPENSOURCE', now,
            localLicense: local.grant, localLicenseReason: local.reason,
        });
    }
    async readBoxGrant(userUid, product, now, transaction) {
        if (!transaction) {
            return this.sequelize.transaction((t) => this.readBoxGrant(userUid, product, now, t));
        }
        let trust;
        try {
            trust = this.trust();
        }
        catch {
            return { grant: null, reason: 'license_invalid' };
        }
        const binding = await this.bindings.findOne({
            where: { user_uid: userUid, product }, transaction,
        });
        if (!binding)
            return { grant: null, reason: 'license_invalid' };
        const document = await this.documents.findByPk(binding.document_uid, {
            transaction, lock: transaction.LOCK.UPDATE,
        });
        if (!document || document.user_uid !== userUid
            || document.revision !== binding.revision) {
            return { grant: null, reason: 'license_invalid' };
        }
        const observed = new Date(document.max_observed_at).getTime();
        if (!Number.isFinite(observed) || now.getTime() < observed) {
            return { grant: null, reason: 'license_invalid' };
        }
        try {
            const verified = (0, license_verifier_1.verifySignedLicense)({
                payload: Buffer.from(document.payload_bytes).toString('base64url'),
                signature: Buffer.from(document.signature_bytes).toString('base64url'),
            }, trust, now);
            if (verified.payload.tenantUid !== userUid
                || verified.payload.revision !== document.revision
                || verified.payload.licenseId !== document.license_id
                || verified.payload.installationId !== document.installation_id
                || verified.digest !== document.digest_sha256) {
                return { grant: null, reason: 'license_invalid' };
            }
            const grant = verified.payload.products.find((item) => item.code === product);
            if (!grant)
                return { grant: null, reason: 'license_invalid' };
            if (now.getTime() > observed) {
                await this.documents.update({ max_observed_at: now }, {
                    where: { uid: document.uid, max_observed_at: { [sequelize_2.Op.lt]: now } }, transaction,
                });
            }
            return { grant: { expiresAt: verified.payload.expiresAt, limits: grant.limits }, reason: 'license_invalid' };
        }
        catch (error) {
            const response = error instanceof common_1.BadRequestException ? error.getResponse() : null;
            const code = typeof response === 'object' && response !== null ? response.code : null;
            return { grant: null, reason: code === 'license_expired' ? 'license_expired' : 'license_invalid' };
        }
    }
    async importLicense(userUid, envelope, actorUserId, replace = false, now = new Date()) {
        if (this.mode() !== 'BOX')
            throw new common_1.ForbiddenException({ code: 'box_license_only' });
        if (!Number.isSafeInteger(userUid) || userUid < 0) {
            throw new common_1.BadRequestException({ code: 'tenant_invalid' });
        }
        const verified = (0, license_verifier_1.verifySignedLicense)(envelope, this.trust(), now);
        const payload = verified.payload;
        if (payload.tenantUid !== userUid) {
            throw new common_1.ForbiddenException({ code: 'license_tenant_mismatch' });
        }
        const result = await this.sequelize.transaction(async (t) => {
            // Lock the tenant row to serialize even first-time imports without bindings.
            const tenant = await this.tenants.findOne({
                where: { vpbx_user_uid: userUid }, transaction: t, lock: t.LOCK.UPDATE,
            });
            if (!tenant)
                throw new common_1.BadRequestException({ code: 'tenant_not_found' });
            const latest = await this.documents.findOne({
                where: { license_id: payload.licenseId },
                order: [['revision', 'DESC']], transaction: t, lock: t.LOCK.UPDATE,
            });
            if (latest && latest.revision > payload.revision) {
                throw new common_1.ConflictException({ code: 'license_revision_downgrade' });
            }
            if (latest && latest.revision === payload.revision
                && latest.digest_sha256 !== verified.digest) {
                throw new common_1.ConflictException({ code: 'license_revision_conflict' });
            }
            if (latest && latest.user_uid !== userUid) {
                throw new common_1.ConflictException({ code: 'license_tenant_conflict' });
            }
            if (latest && now.getTime() < new Date(latest.max_observed_at).getTime()) {
                throw new common_1.ConflictException({ code: 'license_clock_rollback' });
            }
            const current = await this.bindings.findAll({
                where: { user_uid: userUid }, transaction: t, lock: t.LOCK.UPDATE,
            });
            for (const binding of current) {
                const currentDoc = await this.documents.findByPk(binding.document_uid, { transaction: t });
                if (currentDoc && now.getTime() < new Date(currentDoc.max_observed_at).getTime()) {
                    throw new common_1.ConflictException({ code: 'license_clock_rollback' });
                }
                if (currentDoc?.license_id !== payload.licenseId && !replace) {
                    throw new common_1.ConflictException({ code: 'license_replace_required' });
                }
            }
            const sameProducts = current.length === payload.products.length
                && current.every((row) => row.document_uid === latest?.uid
                    && payload.products.some((item) => item.code === row.product));
            if (latest && latest.revision === payload.revision && sameProducts) {
                return { unchanged: true };
            }
            const document = latest?.revision === payload.revision ? latest
                : await this.documents.create({
                    uid: (0, node_crypto_1.randomUUID)(), license_id: payload.licenseId, revision: payload.revision,
                    user_uid: userUid, installation_id: payload.installationId,
                    payload_bytes: verified.payloadBytes, signature_bytes: verified.signatureBytes,
                    digest_sha256: verified.digest, imported_at: now, imported_by: actorUserId,
                    max_observed_at: now,
                }, { transaction: t });
            await this.bindings.destroy({ where: { user_uid: userUid }, transaction: t });
            await this.bindings.bulkCreate(payload.products.map((item) => ({
                user_uid: userUid, product: item.code, document_uid: document.uid,
                revision: payload.revision, actor_user_id: actorUserId, updated_at: now,
            })), { transaction: t });
            await this.actionLogs.create({
                user_id: actorUserId, action: 'ai_license_import', entity_type: 'ai_local_license',
                entity_id: null, user_uid: userUid, status: 'success', created_at: now,
                details: JSON.stringify({ digest: verified.digest, licenseId: payload.licenseId,
                    revision: payload.revision, products: payload.products.map((item) => item.code) }),
            }, { transaction: t });
            return { unchanged: false };
        });
        return {
            licenseId: payload.licenseId, revision: payload.revision, digest: verified.digest,
            products: payload.products.map((item) => item.code), unchanged: result.unchanged,
        };
    }
    async setActivation(userUid, product, enabled, actorUserId, now = new Date()) {
        if (!(0, product_access_policy_1.isAiProductCode)(product) || typeof enabled !== 'boolean') {
            throw new common_1.BadRequestException({ code: 'product_activation_invalid' });
        }
        return this.sequelize.transaction(async (t) => {
            const tenant = await this.tenants.findOne({
                where: { vpbx_user_uid: userUid }, transaction: t, lock: t.LOCK.UPDATE,
            });
            if (!tenant)
                throw new common_1.ForbiddenException({ code: 'tenant_not_found' });
            const row = await this.activations.findOne({
                where: { user_uid: userUid, product }, transaction: t, lock: t.LOCK.UPDATE,
            });
            if (!enabled && !row)
                return { product, enabled, revision: 0 };
            if (enabled) {
                const decision = await this.decide(userUid, product, now, t, true);
                if (!decision.allowed) {
                    throw new common_1.ForbiddenException({ code: decision.reason, product });
                }
            }
            if (row && row.enabled === enabled) {
                return { product, enabled, revision: row.revision };
            }
            const revision = row ? row.revision + 1 : 1;
            if (row)
                await row.update({ enabled, revision, actor_user_id: actorUserId, updated_at: now }, { transaction: t });
            else
                await this.activations.create({
                    user_uid: userUid, product, enabled, revision, actor_user_id: actorUserId, updated_at: now,
                }, { transaction: t });
            await this.actionLogs.create({
                user_id: actorUserId, action: 'ai_product_activation', entity_type: product,
                entity_id: null, user_uid: userUid, status: 'success', created_at: now,
                details: JSON.stringify({ enabled, revision }),
            }, { transaction: t });
            return { product, enabled, revision };
        });
    }
};
exports.ProductAccessService = ProductAccessService;
exports.ProductAccessService = ProductAccessService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(tenant_model_1.Tenant)),
    __param(1, (0, sequelize_1.InjectModel)(tenant_module_model_1.TenantModule)),
    __param(2, (0, sequelize_1.InjectModel)(product_activation_model_1.ProductActivation)),
    __param(3, (0, sequelize_1.InjectModel)(local_license_document_model_1.LocalLicenseDocument)),
    __param(4, (0, sequelize_1.InjectModel)(local_license_binding_model_1.LocalLicenseBinding)),
    __param(5, (0, sequelize_1.InjectModel)(action_log_model_1.ActionLog)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, config_1.ConfigService,
        sequelize_typescript_1.Sequelize])
], ProductAccessService);
//# sourceMappingURL=product-access.service.js.map