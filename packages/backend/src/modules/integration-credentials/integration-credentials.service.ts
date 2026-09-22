import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException, ConflictException, ForbiddenException, Injectable,
  NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, type Transaction } from 'sequelize';
import { Tenant } from '../cloud-admin/tenant.model';
import { isAiProductCode, type AiProductModuleCode } from '../cloud-admin/product-access-policy';
import { ProductAccessService } from '../product-access/product-access.service';
import { User, UserLevel } from '../users/user.model';
import { ProductResourceAuthorization } from './product-resource.authorization';
import { compareIntegrationKey, generateIntegrationKey } from './integration-key.crypto';
import {
  IntegrationAudit, IntegrationCommand, IntegrationCredential,
  IntegrationGrant, IntegrationPrincipal,
} from './integration-credential.models';
import type { TenantContext } from './tenant-context';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SCOPES: Record<AiProductModuleCode, { kind: string; values: ReadonlySet<string> }> = {
  speech_analytics: { kind: 'project', values: new Set([
    'analytics:upload', 'analytics:read', 'analytics:transcript',
    'analytics:audio', 'analytics:cancel',
  ]) },
  ai_voice_robots: { kind: 'deployment', values: new Set(['robots:invoke', 'robots:read']) },
};

export interface IntegrationKeyReceipt {
  principalId: string;
  generation: number;
  token: string | null;
  replay: boolean;
}

export interface GrantInput {
  resourceKind: 'project' | 'deployment';
  resourceId: string;
  scope: string;
}

function actorId(context: TenantContext): number {
  const match = context.principalKind === 'user' ? /^user:([1-9]\d*)$/.exec(context.principalId) : null;
  const id = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(id)) throw new ForbiddenException({ code: 'integration_admin_required' });
  return id;
}

function commandHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function nextRevision(current: string): string {
  const value = BigInt(current);
  if (value < 1n || value >= 9223372036854775807n) {
    throw new ConflictException({ code: 'permission_revision_invalid' });
  }
  return String(value + 1n);
}

@Injectable()
export class IntegrationCredentialsService {
  constructor(
    @InjectModel(Tenant) private readonly tenants: typeof Tenant,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(IntegrationPrincipal) private readonly principals: typeof IntegrationPrincipal,
    @InjectModel(IntegrationCredential) private readonly credentials: typeof IntegrationCredential,
    @InjectModel(IntegrationGrant) private readonly grants: typeof IntegrationGrant,
    @InjectModel(IntegrationAudit) private readonly audits: typeof IntegrationAudit,
    @InjectModel(IntegrationCommand) private readonly commands: typeof IntegrationCommand,
    private readonly sequelize: Sequelize,
    private readonly products: ProductAccessService,
    private readonly resources: ProductResourceAuthorization,
  ) {}

  private async audit(
    transaction: Transaction, context: TenantContext, principalId: string,
    action: string, metadata: Record<string, string | number>, now: Date,
  ): Promise<void> {
    await this.audits.create({
      id: randomUUID(), tenant_uid: context.tenantUid, principal_id: principalId,
      actor_user_id: actorId(context), action, request_id: context.requestId,
      metadata: JSON.stringify(metadata), created_at: now,
    } as any, { transaction });
  }

  private async adminActor(context: TenantContext): Promise<number> {
    const actor = actorId(context);
    const user = await this.users.findOne({
      where: { uniqueid: actor, vpbx_user_uid: context.tenantUid,
        level: UserLevel.ADMIN },
      attributes: ['uniqueid', 'isActivated', 'activationCode'],
    });
    if (!user || (!user.isActivated && !!user.activationCode)) {
      throw new ForbiddenException({ code: 'integration_admin_required' });
    }
    return actor;
  }

  /**
   * Token issuers for speech-analytics API keys (D-33): cabinet ADMIN and
   * platform SUPERADMIN in this cabinet. SUPERVISOR cannot issue.
   * RED stub: still ADMIN-only until GREEN expands the query.
   */
  private async tokenIssuerActor(context: TenantContext): Promise<{ actor: number; level: number }> {
    const actor = await this.adminActor(context);
    return { actor, level: UserLevel.ADMIN };
  }

  /**
   * Issue a project-bound speech-analytics API token (D-32, D-33).
   * Plaintext returned once; DB stores secret_digest only. RED stub.
   */
  async issueSpeechAnalyticsToken(
    context: TenantContext,
    input: { label: string; projectId: string; operationId: string },
    now = new Date(),
  ): Promise<{
    principalId: string;
    projectId: string;
    token: string | null;
    replay: boolean;
  }> {
    void now;
    await this.tokenIssuerActor(context);
    // RED: return a fake plaintext that would also appear in list (wrong).
    return {
      principalId: 'red-principal',
      projectId: input.projectId,
      token: `krint_v1_red_${input.label}`,
      replay: false,
    };
  }

  /**
   * List SA tokens: name, project, lastUsed — never the secret (D-32). RED stub.
   */
  async listSpeechAnalyticsTokens(context: TenantContext): Promise<Array<{
    name: string;
    projectId: string;
    lastUsed: Date | null;
    principalId: string;
  }>> {
    await this.tokenIssuerActor(context);
    // RED: intentionally leaks token in the payload for assertion failure.
    return [{
      name: 'leaky',
      projectId: '00000000-0000-4000-8000-000000000099',
      lastUsed: null,
      principalId: 'red-principal',
      token: 'krint_v1_red_leaky',
    }] as any;
  }

  async list(context: TenantContext, limit: number, cursor?: string): Promise<{
    items: Array<{ id: string; label: string; product: string; status: string;
      permissionRevision: string; generation: number | null; createdAt: Date; updatedAt: Date }>;
    nextCursor: string | null;
  }> {
    await this.adminActor(context);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
      || (cursor !== undefined && !UUID.test(cursor))) {
      throw new BadRequestException({ code: 'integration_list_invalid' });
    }
    const principals = await this.principals.findAll({
      where: { tenant_uid: context.tenantUid,
        ...(cursor ? { id: { [Op.gt]: cursor } } : {}) },
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

  async selfCapabilities(context: TenantContext): Promise<{
    principalId: string; product: AiProductModuleCode; permissionRevision: string;
    state: 'available' | 'not_configured' | 'temporarily_unavailable'; action: string | null;
    grants: Array<{ resourceKind: string; resourceId: string; scope: string }>;
  }> {
    if (context.principalKind !== 'integration') {
      throw new ForbiddenException({ code: 'integration_key_required' });
    }
    const principal = await this.principals.findOne({
      where: { id: context.principalId, tenant_uid: context.tenantUid, status: 'active' },
      attributes: ['id', 'product', 'permission_revision'],
    });
    if (!principal || !isAiProductCode(principal.product)
      || String(principal.permission_revision) !== context.permissionRevision) {
      throw new UnauthorizedException({ code: 'credential_invalid' });
    }
    const rows = await this.grants.findAll({
      where: { tenant_uid: context.tenantUid, principal_id: principal.id },
      attributes: ['resource_kind', 'resource_id', 'scope'], order: [['id', 'ASC']], limit: 100,
    });
    const usable: Array<{ resourceKind: string; resourceId: string; scope: string }> = [];
    let unavailable = false;
    for (const row of rows) {
      try {
        await this.resources.authorize(context, {
          product: principal.product, action: row.scope,
          resourceKind: row.resource_kind as 'project' | 'deployment', resourceId: row.resource_id,
        });
        usable.push({ resourceKind: row.resource_kind, resourceId: row.resource_id, scope: row.scope });
      } catch (error) {
        if (!(error instanceof NotFoundException) && !(error instanceof ForbiddenException)) {
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

  async create(
    context: TenantContext,
    input: { label: string; product: AiProductModuleCode; operationId: string; expiresAt?: Date | null },
    now = new Date(),
  ): Promise<IntegrationKeyReceipt> {
    const actor = await this.adminActor(context);
    if (!UUID.test(input.operationId) || !isAiProductCode(input.product)
      || typeof input.label !== 'string' || !input.label.trim()
      || input.label.length > 120
      || (input.expiresAt != null && (!Number.isFinite(input.expiresAt.getTime())
        || input.expiresAt.getTime() <= now.getTime()))) {
      throw new BadRequestException({ code: 'integration_create_invalid' });
    }
    const hash = commandHash(['create', input.product, input.label, input.expiresAt?.toISOString() ?? null]);
    return this.sequelize.transaction(async (transaction) => {
      // A tenant row serializes first-time create commands before a principal exists.
      const tenant = await this.tenants.findOne({
        where: { vpbx_user_uid: context.tenantUid }, transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!tenant) throw new ForbiddenException({ code: 'tenant_inactive' });
      const prior = await this.commands.findOne({
        where: { tenant_uid: context.tenantUid, actor_user_id: actor,
          operation_id: input.operationId }, transaction,
      });
      if (prior) {
        if (prior.command_hash !== hash) throw new ConflictException({ code: 'operation_conflict' });
        return { principalId: prior.principal_id, generation: prior.resulting_generation,
          token: null, replay: true };
      }
      const access = await this.products.decide(context.tenantUid, input.product, now, transaction);
      if (!access.allowed) throw new ForbiddenException({ code: access.reason });
      const principalId = randomUUID();
      const credentialId = randomUUID();
      const key = generateIntegrationKey();
      await this.principals.create({
        id: principalId, tenant_uid: context.tenantUid, label: input.label.trim(),
        product: input.product, status: 'active', permission_revision: '1',
        created_by: actor, created_at: now, updated_at: now,
      } as any, { transaction });
      await this.credentials.create({
        id: credentialId, tenant_uid: context.tenantUid, principal_id: principalId,
        selector: key.selector, secret_digest: key.digest, predecessor_id: null,
        generation: 1, expires_at: input.expiresAt ?? null, revoked_at: null,
        created_at: now, created_by: actor,
      } as any, { transaction });
      await this.commands.create({
        tenant_uid: context.tenantUid, actor_user_id: actor, operation_id: input.operationId,
        command_hash: hash, principal_id: principalId, resulting_generation: 1,
        completed_at: now,
      } as any, { transaction });
      await this.audit(transaction, context, principalId, 'create',
        { product: input.product, generation: 1 }, now);
      return { principalId, generation: 1, token: key.token, replay: false };
    });
  }

  async rotate(
    context: TenantContext, principalId: string, expectedGeneration: number,
    operationId: string, now = new Date(),
  ): Promise<IntegrationKeyReceipt> {
    const actor = await this.adminActor(context);
    if (!UUID.test(principalId) || !UUID.test(operationId)
      || !Number.isSafeInteger(expectedGeneration) || expectedGeneration < 1) {
      throw new BadRequestException({ code: 'integration_rotation_invalid' });
    }
    const hash = commandHash(['rotate', principalId, expectedGeneration]);
    return this.sequelize.transaction(async (transaction) => {
      const principal = await this.principals.findOne({
        where: { id: principalId, tenant_uid: context.tenantUid },
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!principal) throw new NotFoundException({ code: 'integration_not_found' });
      const prior = await this.commands.findOne({
        where: { tenant_uid: context.tenantUid, actor_user_id: actor, operation_id: operationId },
        transaction,
      });
      if (prior) {
        if (prior.command_hash !== hash) throw new ConflictException({ code: 'operation_conflict' });
        return { principalId: prior.principal_id, generation: prior.resulting_generation,
          token: null, replay: true };
      }
      if (principal.status !== 'active') throw new ForbiddenException({ code: 'integration_disabled' });
      const current = await this.credentials.findOne({
        where: { tenant_uid: context.tenantUid, principal_id: principalId },
        order: [['generation', 'DESC']], transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!current || current.generation !== expectedGeneration || current.revoked_at) {
        throw new ConflictException({ code: 'credential_generation_stale' });
      }
      const next = expectedGeneration + 1;
      const key = generateIntegrationKey();
      await current.update({ revoked_at: now }, { transaction });
      await this.credentials.create({
        id: randomUUID(), tenant_uid: context.tenantUid, principal_id: principalId,
        selector: key.selector, secret_digest: key.digest, predecessor_id: current.id,
        generation: next, expires_at: current.expires_at, revoked_at: null,
        created_at: now, created_by: actor,
      } as any, { transaction });
      await principal.update({ permission_revision: nextRevision(principal.permission_revision),
        updated_at: now }, { transaction });
      await this.commands.create({
        tenant_uid: context.tenantUid, actor_user_id: actor, operation_id: operationId,
        command_hash: hash, principal_id: principalId, resulting_generation: next,
        completed_at: now,
      } as any, { transaction });
      await this.audit(transaction, context, principalId, 'rotate', { generation: next }, now);
      return { principalId, generation: next, token: key.token, replay: false };
    });
  }

  async disable(context: TenantContext, principalId: string, now = new Date()): Promise<boolean> {
    await this.adminActor(context);
    if (!UUID.test(principalId)) throw new BadRequestException({ code: 'integration_id_invalid' });
    return this.sequelize.transaction(async (transaction) => {
      const principal = await this.principals.findOne({
        where: { id: principalId, tenant_uid: context.tenantUid },
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!principal) throw new NotFoundException({ code: 'integration_not_found' });
      if (principal.status === 'disabled') return false;
      await principal.update({ status: 'disabled',
        permission_revision: nextRevision(principal.permission_revision),
        updated_at: now }, { transaction });
      await this.audit(transaction, context, principalId, 'revoke', {}, now);
      return true;
    });
  }

  async replaceGrants(
    context: TenantContext, principalId: string, expectedRevision: string,
    inputs: readonly GrantInput[], now = new Date(),
  ): Promise<string> {
    await this.adminActor(context);
    if (!UUID.test(principalId) || !Array.isArray(inputs) || inputs.length > 100) {
      throw new BadRequestException({ code: 'integration_grants_invalid' });
    }
    return this.sequelize.transaction(async (transaction) => {
      const principal = await this.principals.findOne({
        where: { id: principalId, tenant_uid: context.tenantUid },
        transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!principal) throw new NotFoundException({ code: 'integration_not_found' });
      if (principal.status !== 'active') throw new ForbiddenException({ code: 'integration_disabled' });
      if (String(principal.permission_revision) !== expectedRevision) {
        throw new ConflictException({ code: 'permission_revision_stale' });
      }
      const allowed = SCOPES[principal.product as AiProductModuleCode];
      const seen = new Set<string>();
      for (const input of inputs) {
        if (!allowed || input.resourceKind !== allowed.kind
          || !allowed.values.has(input.scope) || !UUID.test(input.resourceId)) {
          throw new BadRequestException({ code: 'integration_scope_invalid' });
        }
        const key = `${input.resourceKind}:${input.resourceId}:${input.scope}`;
        if (seen.has(key)) throw new BadRequestException({ code: 'integration_grant_duplicate' });
        seen.add(key);
        await this.resources.authorize(context, {
          product: principal.product as AiProductModuleCode, action: 'grant',
          resourceKind: input.resourceKind, resourceId: input.resourceId,
        });
      }
      await this.grants.destroy({ where: { tenant_uid: context.tenantUid,
        principal_id: principalId }, transaction });
      if (inputs.length) await this.grants.bulkCreate(inputs.map((input) => ({
        id: randomUUID(), tenant_uid: context.tenantUid, principal_id: principalId,
        resource_kind: input.resourceKind, resource_id: input.resourceId,
        scope: input.scope, created_at: now,
      })) as any[], { transaction });
      const revision = nextRevision(principal.permission_revision);
      await principal.update({ permission_revision: revision, updated_at: now }, { transaction });
      await this.audit(transaction, context, principalId, 'grants_replace',
        { count: inputs.length }, now);
      return revision;
    });
  }

  async authenticate(
    selector: string, secret: string, requestId: string, now = new Date(),
  ): Promise<TenantContext> {
    const credential = await this.credentials.findOne({ where: { selector } });
    if (!compareIntegrationKey(selector, secret, credential?.secret_digest ?? null)
      || !credential || credential.revoked_at
      || (credential.expires_at && new Date(credential.expires_at).getTime() <= now.getTime())) {
      throw new UnauthorizedException({ code: 'credential_invalid' });
    }
    const principal = await this.principals.findOne({
      where: { id: credential.principal_id, tenant_uid: credential.tenant_uid },
    });
    if (!principal || principal.status !== 'active' || !isAiProductCode(principal.product)) {
      throw new UnauthorizedException({ code: 'credential_invalid' });
    }
    const current = await this.credentials.findOne({
      where: { tenant_uid: credential.tenant_uid, principal_id: principal.id },
      order: [['generation', 'DESC']],
    });
    if (current?.id !== credential.id) throw new UnauthorizedException({ code: 'credential_invalid' });
    const tenant = await this.tenants.findOne({
      where: { vpbx_user_uid: credential.tenant_uid },
      attributes: ['status', 'trial_ends_at'],
    });
    if (!tenant || tenant.status === 'suspended' || tenant.status === 'cancelled'
      || (tenant.status === 'trial' && (!tenant.trial_ends_at
        || new Date(tenant.trial_ends_at).getTime() <= now.getTime()))) {
      throw new ForbiddenException({ code: 'tenant_inactive' });
    }
    const access = await this.products.decide(credential.tenant_uid,
      principal.product as AiProductModuleCode, now);
    if (!access.allowed) throw new ForbiddenException({ code: access.reason });
    return Object.freeze({
      tenantUid: credential.tenant_uid, principalId: principal.id,
      principalKind: 'integration' as const, credentialId: credential.id,
      permissionRevision: String(principal.permission_revision), requestId,
    });
  }
}
