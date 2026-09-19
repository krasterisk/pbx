import { randomUUID } from 'node:crypto';
import {
  BadRequestException, ConflictException, ForbiddenException, Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Tenant } from '../cloud-admin/tenant.model';
import { TenantModule } from '../cloud-admin/tenant-module.model';
import {
  isAiProductCode, resolveProductAccess,
  type AiProductModuleCode, type ProductAccessDecision,
} from '../cloud-admin/product-access-policy';
import { ActionLog } from '../logger/action-log.model';
import { ProductActivation } from './product-activation.model';
import { LocalLicenseDocument } from './local-license-document.model';
import { LocalLicenseBinding } from './local-license-binding.model';
import {
  verifySignedLicense, type LicenseTrust, type SignedLicenseEnvelope,
} from './license-verifier';

type BoxGrant = {
  grant: { expiresAt: string; limits: Record<string, number> } | null;
  reason: 'license_invalid' | 'license_expired';
};

@Injectable()
export class ProductAccessService {
  constructor(
    @InjectModel(Tenant) private readonly tenants: typeof Tenant,
    @InjectModel(TenantModule) private readonly tenantModules: typeof TenantModule,
    @InjectModel(ProductActivation) private readonly activations: typeof ProductActivation,
    @InjectModel(LocalLicenseDocument) private readonly documents: typeof LocalLicenseDocument,
    @InjectModel(LocalLicenseBinding) private readonly bindings: typeof LocalLicenseBinding,
    @InjectModel(ActionLog) private readonly actionLogs: typeof ActionLog,
    private readonly config: ConfigService,
    private readonly sequelize: Sequelize,
  ) {}

  private mode(): string {
    return this.config.get<string>('DEPLOYMENT_MODE', 'BOX').toUpperCase();
  }

  private trust(): LicenseTrust {
    const issuer = this.config.get<string>('AI_LICENSE_ISSUER');
    const installationId = this.config.get<string>('AI_LICENSE_INSTALLATION_ID');
    const raw = this.config.get<string>('AI_LICENSE_PUBLIC_KEYS_JSON');
    if (!issuer || !installationId || !raw) {
      throw new ServiceUnavailableException({ code: 'license_trust_not_configured' });
    }
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { throw new ServiceUnavailableException({ code: 'license_trust_not_configured' }); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
      || Object.keys(parsed).length === 0
      || Object.values(parsed).some((pem) => typeof pem !== 'string')) {
      throw new ServiceUnavailableException({ code: 'license_trust_not_configured' });
    }
    return { issuer, installationId, publicKeys: parsed as Record<string, string> };
  }

  async decide(
    userUid: number, product: AiProductModuleCode, now = new Date(),
    transaction?: Transaction, activationOverride?: boolean,
  ): Promise<ProductAccessDecision> {
    if (!isAiProductCode(product) || !Number.isSafeInteger(userUid) || userUid < 0) {
      throw new BadRequestException({ code: 'UNKNOWN_AI_PRODUCT_OR_TENANT' });
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
    let local: BoxGrant = { grant: null, reason: 'license_invalid' };
    if (mode === 'BOX' && tenant) {
      local = await this.readBoxGrant(userUid, product, now, transaction);
    }
    return resolveProductAccess({
      product, deploymentMode: mode, tenant, grants,
      activationEnabled: enabled, packageInstalled: mode !== 'OPENSOURCE', now,
      localLicense: local.grant, localLicenseReason: local.reason,
    });
  }

  private async readBoxGrant(
    userUid: number, product: AiProductModuleCode, now: Date,
    transaction?: Transaction,
  ): Promise<BoxGrant> {
    if (!transaction) {
      return this.sequelize.transaction((t) => this.readBoxGrant(userUid, product, now, t));
    }
    let trust: LicenseTrust;
    try { trust = this.trust(); }
    catch { return { grant: null, reason: 'license_invalid' }; }
    const binding = await this.bindings.findOne({
      where: { user_uid: userUid, product }, transaction,
    });
    if (!binding) return { grant: null, reason: 'license_invalid' };
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
      const verified = verifySignedLicense({
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
      if (!grant) return { grant: null, reason: 'license_invalid' };
      if (now.getTime() > observed) {
        await this.documents.update({ max_observed_at: now }, {
          where: { uid: document.uid, max_observed_at: { [Op.lt]: now } }, transaction,
        });
      }
      return { grant: { expiresAt: verified.payload.expiresAt, limits: grant.limits }, reason: 'license_invalid' };
    } catch (error) {
      const response = error instanceof BadRequestException ? error.getResponse() : null;
      const code = typeof response === 'object' && response !== null ? (response as any).code : null;
      return { grant: null, reason: code === 'license_expired' ? 'license_expired' : 'license_invalid' };
    }
  }

  async importLicense(
    userUid: number, envelope: SignedLicenseEnvelope,
    actorUserId: number, replace = false, now = new Date(),
  ): Promise<{ licenseId: string; revision: number; digest: string; products: AiProductModuleCode[]; unchanged: boolean }> {
    if (this.mode() !== 'BOX') throw new ForbiddenException({ code: 'box_license_only' });
    if (!Number.isSafeInteger(userUid) || userUid < 0) {
      throw new BadRequestException({ code: 'tenant_invalid' });
    }
    const verified = verifySignedLicense(envelope, this.trust(), now);
    const payload = verified.payload;
    if (payload.tenantUid !== userUid) {
      throw new ForbiddenException({ code: 'license_tenant_mismatch' });
    }
    const result = await this.sequelize.transaction(async (t) => {
      // Lock the tenant row to serialize even first-time imports without bindings.
      const tenant = await this.tenants.findOne({
        where: { vpbx_user_uid: userUid }, transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!tenant) throw new BadRequestException({ code: 'tenant_not_found' });
      const latest = await this.documents.findOne({
        where: { license_id: payload.licenseId },
        order: [['revision', 'DESC']], transaction: t, lock: t.LOCK.UPDATE,
      });
      if (latest && latest.revision > payload.revision) {
        throw new ConflictException({ code: 'license_revision_downgrade' });
      }
      if (latest && latest.revision === payload.revision
        && latest.digest_sha256 !== verified.digest) {
        throw new ConflictException({ code: 'license_revision_conflict' });
      }
      if (latest && latest.user_uid !== userUid) {
        throw new ConflictException({ code: 'license_tenant_conflict' });
      }
      if (latest && now.getTime() < new Date(latest.max_observed_at).getTime()) {
        throw new ConflictException({ code: 'license_clock_rollback' });
      }
      const current = await this.bindings.findAll({
        where: { user_uid: userUid }, transaction: t, lock: t.LOCK.UPDATE,
      });
      for (const binding of current) {
        const currentDoc = await this.documents.findByPk(binding.document_uid, { transaction: t });
        if (currentDoc && now.getTime() < new Date(currentDoc.max_observed_at).getTime()) {
          throw new ConflictException({ code: 'license_clock_rollback' });
        }
        if (currentDoc?.license_id !== payload.licenseId && !replace) {
          throw new ConflictException({ code: 'license_replace_required' });
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
          uid: randomUUID(), license_id: payload.licenseId, revision: payload.revision,
          user_uid: userUid, installation_id: payload.installationId,
          payload_bytes: verified.payloadBytes, signature_bytes: verified.signatureBytes,
          digest_sha256: verified.digest, imported_at: now, imported_by: actorUserId,
          max_observed_at: now,
        } as any, { transaction: t });
      await this.bindings.destroy({ where: { user_uid: userUid }, transaction: t });
      await this.bindings.bulkCreate(payload.products.map((item) => ({
        user_uid: userUid, product: item.code, document_uid: document.uid,
        revision: payload.revision, actor_user_id: actorUserId, updated_at: now,
      })) as any[], { transaction: t });
      await this.actionLogs.create({
        user_id: actorUserId, action: 'ai_license_import', entity_type: 'ai_local_license',
        entity_id: null, user_uid: userUid, status: 'success', created_at: now,
        details: JSON.stringify({ digest: verified.digest, licenseId: payload.licenseId,
          revision: payload.revision, products: payload.products.map((item) => item.code) }),
      } as any, { transaction: t });
      return { unchanged: false };
    });
    return {
      licenseId: payload.licenseId, revision: payload.revision, digest: verified.digest,
      products: payload.products.map((item) => item.code), unchanged: result.unchanged,
    };
  }

  async setActivation(
    userUid: number, product: AiProductModuleCode, enabled: boolean,
    actorUserId: number, now = new Date(),
  ): Promise<{ product: AiProductModuleCode; enabled: boolean; revision: number }> {
    if (!isAiProductCode(product) || typeof enabled !== 'boolean') {
      throw new BadRequestException({ code: 'product_activation_invalid' });
    }
    return this.sequelize.transaction(async (t) => {
      const tenant = await this.tenants.findOne({
        where: { vpbx_user_uid: userUid }, transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!tenant) throw new ForbiddenException({ code: 'tenant_not_found' });
      const row = await this.activations.findOne({
        where: { user_uid: userUid, product }, transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!enabled && !row) return { product, enabled, revision: 0 };
      if (enabled) {
        const decision = await this.decide(userUid, product, now, t, true);
        if (!decision.allowed) {
          throw new ForbiddenException({ code: decision.reason, product });
        }
      }
      if (row && row.enabled === enabled) {
        return { product, enabled, revision: row.revision };
      }
      const revision = row ? row.revision + 1 : 1;
      if (row) await row.update({ enabled, revision, actor_user_id: actorUserId, updated_at: now }, { transaction: t });
      else await this.activations.create({
        user_uid: userUid, product, enabled, revision, actor_user_id: actorUserId, updated_at: now,
      } as any, { transaction: t });
      await this.actionLogs.create({
        user_id: actorUserId, action: 'ai_product_activation', entity_type: product,
        entity_id: null, user_uid: userUid, status: 'success', created_at: now,
        details: JSON.stringify({ enabled, revision }),
      } as any, { transaction: t });
      return { product, enabled, revision };
    });
  }
}
