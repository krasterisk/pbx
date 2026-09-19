import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ProductAccessService } from '../product-access/product-access.service';
import type { TenantContext } from '../integration-credentials/tenant-context';
import {
  assertKnowledgeSource, chunkText, DomainError, lexicalRetrieve, manifestDigest,
} from './knowledge-engine';
import {
  KbAccessBinding, KbBase,
} from './knowledge.models';
import { randomUUID } from 'node:crypto';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly products: ProductAccessService,
    @InjectModel(KbBase) private readonly bases: typeof KbBase,
    @InjectModel(KbAccessBinding) private readonly access: typeof KbAccessBinding,
  ) {}

  private mapError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof DomainError) throw new HttpException({ code: error.code }, error.status);
    throw error;
  }

  async list(context: TenantContext) {
    return this.bases.findAll({ where: { tenant_uid: context.tenantUid } });
  }

  async createBase(context: TenantContext, name: string) {
    try {
      const access = await this.products.decide(context.tenantUid, 'ai_voice_robots');
      if (!access.allowed) throw new DomainError('entitlement', 403);
      return this.bases.create({
        id: randomUUID(), tenant_uid: context.tenantUid, name, status: 'draft', draft_revision: 1,
        created_by: Number(context.principalId) || 0, created_at: new Date(), updated_at: new Date(),
      });
    } catch (error) { this.mapError(error); }
  }

  ingestPreview(mime: string, text: string) {
    assertKnowledgeSource({ mime, bytes: Buffer.byteLength(text), text });
    return chunkText(text);
  }

  search(query: string, chunks: Array<{ id: string; text: string; allowed: boolean }>) {
    return lexicalRetrieve(query, chunks);
  }

  releaseDigest(memberIds: string[]) {
    return manifestDigest(memberIds);
  }

  async revoke(context: TenantContext, baseId: string, principalKind: 'user' | 'robot', principalId: string) {
    try {
      const row = await this.access.findOne({
        where: { tenant_uid: context.tenantUid, base_id: baseId, principal_kind: principalKind, principal_id: principalId },
      });
      if (row) await row.destroy();
      return { revoked: true };
    } catch (error) { this.mapError(error); }
  }
}
