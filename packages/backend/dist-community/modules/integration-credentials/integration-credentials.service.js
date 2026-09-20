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
exports.IntegrationCredentialsService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const sequelize_2 = require("sequelize");
const tenant_model_1 = require("../cloud-admin/tenant.model");
const product_access_policy_1 = require("../cloud-admin/product-access-policy");
const product_access_service_1 = require("../product-access/product-access.service");
const user_model_1 = require("../users/user.model");
const product_resource_authorization_1 = require("./product-resource.authorization");
const integration_key_crypto_1 = require("./integration-key.crypto");
const integration_credential_models_1 = require("./integration-credential.models");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SCOPES = {
    speech_analytics: { kind: 'project', values: new Set([
            'analytics:upload', 'analytics:read', 'analytics:transcript',
            'analytics:audio', 'analytics:cancel',
        ]) },
    ai_voice_robots: { kind: 'deployment', values: new Set(['robots:invoke', 'robots:read']) },
};
function actorId(context) {
    const match = context.principalKind === 'user' ? /^user:([1-9]\d*)$/.exec(context.principalId) : null;
    const id = match ? Number(match[1]) : NaN;
    if (!Number.isSafeInteger(id))
        throw new common_1.ForbiddenException({ code: 'integration_admin_required' });
    return id;
}
function commandHash(value) {
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(value)).digest('hex');
}
function nextRevision(current) {
    const value = BigInt(current);
    if (value < 1n || value >= 9223372036854775807n) {
        throw new common_1.ConflictException({ code: 'permission_revision_invalid' });
    }
    return String(value + 1n);
}
let IntegrationCredentialsService = class IntegrationCredentialsService {
    tenants;
    users;
    principals;
    credentials;
    grants;
    audits;
    commands;
    sequelize;
    products;
    resources;
    constructor(tenants, users, principals, credentials, grants, audits, commands, sequelize, products, resources) {
        this.tenants = tenants;
        this.users = users;
        this.principals = principals;
        this.credentials = credentials;
        this.grants = grants;
        this.audits = audits;
        this.commands = commands;
        this.sequelize = sequelize;
        this.products = products;
        this.resources = resources;
    }
    async audit(transaction, context, principalId, action, metadata, now) {
        await this.audits.create({
            id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, principal_id: principalId,
            actor_user_id: actorId(context), action, request_id: context.requestId,
            metadata: JSON.stringify(metadata), created_at: now,
        }, { transaction });
    }
    async adminActor(context) {
        const actor = actorId(context);
        const user = await this.users.findOne({
            where: { uniqueid: actor, vpbx_user_uid: context.tenantUid,
                level: user_model_1.UserLevel.ADMIN },
            attributes: ['uniqueid', 'isActivated', 'activationCode'],
        });
        if (!user || (!user.isActivated && !!user.activationCode)) {
            throw new common_1.ForbiddenException({ code: 'integration_admin_required' });
        }
        return actor;
    }
    async list(context, limit, cursor) {
        await this.adminActor(context);
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
            || (cursor !== undefined && !UUID.test(cursor))) {
            throw new common_1.BadRequestException({ code: 'integration_list_invalid' });
        }
        const principals = await this.principals.findAll({
            where: { tenant_uid: context.tenantUid,
                ...(cursor ? { id: { [sequelize_2.Op.gt]: cursor } } : {}) },
            attributes: ['id', 'label', 'product', 'status', 'permission_revision', 'created_at', 'updated_at'],
            order: [['id', 'ASC']], limit: limit + 1,
        });
        const page = principals.slice(0, limit);
        const items = await Promise.all(page.map(async (principal) => {
            const current = await this.credentials.findOne({
                where: { tenant_uid: context.tenantUid, principal_id: principal.id },
                attributes: ['generation'], order: [['generation', 'DESC']],
            });
            return {
                id: principal.id, label: principal.label, product: principal.product,
                status: principal.status, permissionRevision: String(principal.permission_revision),
                generation: current?.generation ?? null,
                createdAt: principal.created_at, updatedAt: principal.updated_at,
            };
        }));
        return { items, nextCursor: principals.length > limit ? page[page.length - 1].id : null };
    }
    async selfCapabilities(context) {
        if (context.principalKind !== 'integration') {
            throw new common_1.ForbiddenException({ code: 'integration_key_required' });
        }
        const principal = await this.principals.findOne({
            where: { id: context.principalId, tenant_uid: context.tenantUid, status: 'active' },
            attributes: ['id', 'product', 'permission_revision'],
        });
        if (!principal || !(0, product_access_policy_1.isAiProductCode)(principal.product)
            || String(principal.permission_revision) !== context.permissionRevision) {
            throw new common_1.UnauthorizedException({ code: 'credential_invalid' });
        }
        const rows = await this.grants.findAll({
            where: { tenant_uid: context.tenantUid, principal_id: principal.id },
            attributes: ['resource_kind', 'resource_id', 'scope'], order: [['id', 'ASC']], limit: 100,
        });
        const usable = [];
        let unavailable = false;
        for (const row of rows) {
            try {
                await this.resources.authorize(context, {
                    product: principal.product, action: row.scope,
                    resourceKind: row.resource_kind, resourceId: row.resource_id,
                });
                usable.push({ resourceKind: row.resource_kind, resourceId: row.resource_id, scope: row.scope });
            }
            catch (error) {
                if (!(error instanceof common_1.NotFoundException) && !(error instanceof common_1.ForbiddenException)) {
                    unavailable = true;
                }
            }
        }
        if (unavailable) {
            return { principalId: principal.id, product: principal.product,
                permissionRevision: String(principal.permission_revision),
                state: 'temporarily_unavailable', action: 'retry_later', grants: [] };
        }
        return { principalId: principal.id, product: principal.product,
            permissionRevision: String(principal.permission_revision),
            state: usable.length ? 'available' : 'not_configured',
            action: usable.length ? null : principal.product === 'speech_analytics'
                ? 'create_project' : 'create_deployment', grants: usable };
    }
    async create(context, input, now = new Date()) {
        const actor = await this.adminActor(context);
        if (!UUID.test(input.operationId) || !(0, product_access_policy_1.isAiProductCode)(input.product)
            || typeof input.label !== 'string' || !input.label.trim()
            || input.label.length > 120
            || (input.expiresAt != null && (!Number.isFinite(input.expiresAt.getTime())
                || input.expiresAt.getTime() <= now.getTime()))) {
            throw new common_1.BadRequestException({ code: 'integration_create_invalid' });
        }
        const hash = commandHash(['create', input.product, input.label, input.expiresAt?.toISOString() ?? null]);
        return this.sequelize.transaction(async (transaction) => {
            // A tenant row serializes first-time create commands before a principal exists.
            const tenant = await this.tenants.findOne({
                where: { vpbx_user_uid: context.tenantUid }, transaction, lock: transaction.LOCK.UPDATE,
            });
            if (!tenant)
                throw new common_1.ForbiddenException({ code: 'tenant_inactive' });
            const prior = await this.commands.findOne({
                where: { tenant_uid: context.tenantUid, actor_user_id: actor,
                    operation_id: input.operationId }, transaction,
            });
            if (prior) {
                if (prior.command_hash !== hash)
                    throw new common_1.ConflictException({ code: 'operation_conflict' });
                return { principalId: prior.principal_id, generation: prior.resulting_generation,
                    token: null, replay: true };
            }
            const access = await this.products.decide(context.tenantUid, input.product, now, transaction);
            if (!access.allowed)
                throw new common_1.ForbiddenException({ code: access.reason });
            const principalId = (0, node_crypto_1.randomUUID)();
            const credentialId = (0, node_crypto_1.randomUUID)();
            const key = (0, integration_key_crypto_1.generateIntegrationKey)();
            await this.principals.create({
                id: principalId, tenant_uid: context.tenantUid, label: input.label.trim(),
                product: input.product, status: 'active', permission_revision: '1',
                created_by: actor, created_at: now, updated_at: now,
            }, { transaction });
            await this.credentials.create({
                id: credentialId, tenant_uid: context.tenantUid, principal_id: principalId,
                selector: key.selector, secret_digest: key.digest, predecessor_id: null,
                generation: 1, expires_at: input.expiresAt ?? null, revoked_at: null,
                created_at: now, created_by: actor,
            }, { transaction });
            await this.commands.create({
                tenant_uid: context.tenantUid, actor_user_id: actor, operation_id: input.operationId,
                command_hash: hash, principal_id: principalId, resulting_generation: 1,
                completed_at: now,
            }, { transaction });
            await this.audit(transaction, context, principalId, 'create', { product: input.product, generation: 1 }, now);
            return { principalId, generation: 1, token: key.token, replay: false };
        });
    }
    async rotate(context, principalId, expectedGeneration, operationId, now = new Date()) {
        const actor = await this.adminActor(context);
        if (!UUID.test(principalId) || !UUID.test(operationId)
            || !Number.isSafeInteger(expectedGeneration) || expectedGeneration < 1) {
            throw new common_1.BadRequestException({ code: 'integration_rotation_invalid' });
        }
        const hash = commandHash(['rotate', principalId, expectedGeneration]);
        return this.sequelize.transaction(async (transaction) => {
            const principal = await this.principals.findOne({
                where: { id: principalId, tenant_uid: context.tenantUid },
                transaction, lock: transaction.LOCK.UPDATE,
            });
            if (!principal)
                throw new common_1.NotFoundException({ code: 'integration_not_found' });
            const prior = await this.commands.findOne({
                where: { tenant_uid: context.tenantUid, actor_user_id: actor, operation_id: operationId },
                transaction,
            });
            if (prior) {
                if (prior.command_hash !== hash)
                    throw new common_1.ConflictException({ code: 'operation_conflict' });
                return { principalId: prior.principal_id, generation: prior.resulting_generation,
                    token: null, replay: true };
            }
            if (principal.status !== 'active')
                throw new common_1.ForbiddenException({ code: 'integration_disabled' });
            const current = await this.credentials.findOne({
                where: { tenant_uid: context.tenantUid, principal_id: principalId },
                order: [['generation', 'DESC']], transaction, lock: transaction.LOCK.UPDATE,
            });
            if (!current || current.generation !== expectedGeneration || current.revoked_at) {
                throw new common_1.ConflictException({ code: 'credential_generation_stale' });
            }
            const next = expectedGeneration + 1;
            const key = (0, integration_key_crypto_1.generateIntegrationKey)();
            await current.update({ revoked_at: now }, { transaction });
            await this.credentials.create({
                id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, principal_id: principalId,
                selector: key.selector, secret_digest: key.digest, predecessor_id: current.id,
                generation: next, expires_at: current.expires_at, revoked_at: null,
                created_at: now, created_by: actor,
            }, { transaction });
            await principal.update({ permission_revision: nextRevision(principal.permission_revision),
                updated_at: now }, { transaction });
            await this.commands.create({
                tenant_uid: context.tenantUid, actor_user_id: actor, operation_id: operationId,
                command_hash: hash, principal_id: principalId, resulting_generation: next,
                completed_at: now,
            }, { transaction });
            await this.audit(transaction, context, principalId, 'rotate', { generation: next }, now);
            return { principalId, generation: next, token: key.token, replay: false };
        });
    }
    async disable(context, principalId, now = new Date()) {
        await this.adminActor(context);
        if (!UUID.test(principalId))
            throw new common_1.BadRequestException({ code: 'integration_id_invalid' });
        return this.sequelize.transaction(async (transaction) => {
            const principal = await this.principals.findOne({
                where: { id: principalId, tenant_uid: context.tenantUid },
                transaction, lock: transaction.LOCK.UPDATE,
            });
            if (!principal)
                throw new common_1.NotFoundException({ code: 'integration_not_found' });
            if (principal.status === 'disabled')
                return false;
            await principal.update({ status: 'disabled',
                permission_revision: nextRevision(principal.permission_revision),
                updated_at: now }, { transaction });
            await this.audit(transaction, context, principalId, 'revoke', {}, now);
            return true;
        });
    }
    async replaceGrants(context, principalId, expectedRevision, inputs, now = new Date()) {
        await this.adminActor(context);
        if (!UUID.test(principalId) || !Array.isArray(inputs) || inputs.length > 100) {
            throw new common_1.BadRequestException({ code: 'integration_grants_invalid' });
        }
        return this.sequelize.transaction(async (transaction) => {
            const principal = await this.principals.findOne({
                where: { id: principalId, tenant_uid: context.tenantUid },
                transaction, lock: transaction.LOCK.UPDATE,
            });
            if (!principal)
                throw new common_1.NotFoundException({ code: 'integration_not_found' });
            if (principal.status !== 'active')
                throw new common_1.ForbiddenException({ code: 'integration_disabled' });
            if (String(principal.permission_revision) !== expectedRevision) {
                throw new common_1.ConflictException({ code: 'permission_revision_stale' });
            }
            const allowed = SCOPES[principal.product];
            const seen = new Set();
            for (const input of inputs) {
                if (!allowed || input.resourceKind !== allowed.kind
                    || !allowed.values.has(input.scope) || !UUID.test(input.resourceId)) {
                    throw new common_1.BadRequestException({ code: 'integration_scope_invalid' });
                }
                const key = `${input.resourceKind}:${input.resourceId}:${input.scope}`;
                if (seen.has(key))
                    throw new common_1.BadRequestException({ code: 'integration_grant_duplicate' });
                seen.add(key);
                await this.resources.authorize(context, {
                    product: principal.product, action: 'grant',
                    resourceKind: input.resourceKind, resourceId: input.resourceId,
                });
            }
            await this.grants.destroy({ where: { tenant_uid: context.tenantUid,
                    principal_id: principalId }, transaction });
            if (inputs.length)
                await this.grants.bulkCreate(inputs.map((input) => ({
                    id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, principal_id: principalId,
                    resource_kind: input.resourceKind, resource_id: input.resourceId,
                    scope: input.scope, created_at: now,
                })), { transaction });
            const revision = nextRevision(principal.permission_revision);
            await principal.update({ permission_revision: revision, updated_at: now }, { transaction });
            await this.audit(transaction, context, principalId, 'grants_replace', { count: inputs.length }, now);
            return revision;
        });
    }
    async authenticate(selector, secret, requestId, now = new Date()) {
        const credential = await this.credentials.findOne({ where: { selector } });
        if (!(0, integration_key_crypto_1.compareIntegrationKey)(selector, secret, credential?.secret_digest ?? null)
            || !credential || credential.revoked_at
            || (credential.expires_at && new Date(credential.expires_at).getTime() <= now.getTime())) {
            throw new common_1.UnauthorizedException({ code: 'credential_invalid' });
        }
        const principal = await this.principals.findOne({
            where: { id: credential.principal_id, tenant_uid: credential.tenant_uid },
        });
        if (!principal || principal.status !== 'active' || !(0, product_access_policy_1.isAiProductCode)(principal.product)) {
            throw new common_1.UnauthorizedException({ code: 'credential_invalid' });
        }
        const current = await this.credentials.findOne({
            where: { tenant_uid: credential.tenant_uid, principal_id: principal.id },
            order: [['generation', 'DESC']],
        });
        if (current?.id !== credential.id)
            throw new common_1.UnauthorizedException({ code: 'credential_invalid' });
        const tenant = await this.tenants.findOne({
            where: { vpbx_user_uid: credential.tenant_uid },
            attributes: ['status', 'trial_ends_at'],
        });
        if (!tenant || tenant.status === 'suspended' || tenant.status === 'cancelled'
            || (tenant.status === 'trial' && (!tenant.trial_ends_at
                || new Date(tenant.trial_ends_at).getTime() <= now.getTime()))) {
            throw new common_1.ForbiddenException({ code: 'tenant_inactive' });
        }
        const access = await this.products.decide(credential.tenant_uid, principal.product, now);
        if (!access.allowed)
            throw new common_1.ForbiddenException({ code: access.reason });
        return Object.freeze({
            tenantUid: credential.tenant_uid, principalId: principal.id,
            principalKind: 'integration', credentialId: credential.id,
            permissionRevision: String(principal.permission_revision), requestId,
        });
    }
};
exports.IntegrationCredentialsService = IntegrationCredentialsService;
exports.IntegrationCredentialsService = IntegrationCredentialsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(tenant_model_1.Tenant)),
    __param(1, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __param(2, (0, sequelize_1.InjectModel)(integration_credential_models_1.IntegrationPrincipal)),
    __param(3, (0, sequelize_1.InjectModel)(integration_credential_models_1.IntegrationCredential)),
    __param(4, (0, sequelize_1.InjectModel)(integration_credential_models_1.IntegrationGrant)),
    __param(5, (0, sequelize_1.InjectModel)(integration_credential_models_1.IntegrationAudit)),
    __param(6, (0, sequelize_1.InjectModel)(integration_credential_models_1.IntegrationCommand)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, sequelize_typescript_1.Sequelize,
        product_access_service_1.ProductAccessService,
        product_resource_authorization_1.ProductResourceAuthorization])
], IntegrationCredentialsService);
//# sourceMappingURL=integration-credentials.service.js.map