import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ProductAccessService } from '../product-access/product-access.service';
import type { TenantContext } from '../integration-credentials/tenant-context';
import {
  assertKnowledgeSource, chunkText, DomainError, lexicalRetrieve, manifestDigest, vectorRetrieve,
} from './knowledge-engine';
import {
  KbAccessBinding, KbBase, KbChunk, KbDocument, KbDocumentRevision,
} from './knowledge.models';
import { randomUUID } from 'node:crypto';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly products: ProductAccessService,
    @InjectModel(KbBase) private readonly bases: typeof KbBase,
    @InjectModel(KbAccessBinding) private readonly access: typeof KbAccessBinding,
    @InjectModel(KbDocument) private readonly documents: typeof KbDocument,
    @InjectModel(KbDocumentRevision) private readonly revisions: typeof KbDocumentRevision,
    @InjectModel(KbChunk) private readonly chunks: typeof KbChunk,
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
      const principal = /^user:(\d+)$/.exec(context.principalId);
      return this.bases.create({
        id: randomUUID(), tenant_uid: context.tenantUid, name, status: 'draft', draft_revision: 1,
        created_by: principal ? Number(principal[1]) : 0, created_at: new Date(), updated_at: new Date(),
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

  async searchVector(
    query: string,
    chunks: Array<{ id: string; text: string; allowed: boolean; vector: Float32Array }>,
    embedder: { embed(text: string, isQuery?: boolean): Promise<Float32Array> },
  ) {
    return vectorRetrieve(query, chunks, embedder);
  }

  releaseDigest(memberIds: string[]) {
    return manifestDigest(memberIds);
  }

  async addText(context: TenantContext, baseId: string, title: string, text: string, mime = 'text/markdown') {
    try {
      const base = await this.bases.findOne({ where: { tenant_uid: context.tenantUid, id: baseId } });
      if (!base) throw new DomainError('resource_not_found', 404);
      assertKnowledgeSource({ mime, bytes: Buffer.byteLength(text), text });
      const pieces = chunkText(text, 180, 24);
      const document = await this.documents.create({
        id: randomUUID(), tenant_uid: context.tenantUid, base_id: baseId, source_asset_id: randomUUID(),
        content_hash: manifestDigest([text]), status: 'ready', tombstoned_at: null, created_at: new Date(),
      });
      const revision = await this.revisions.create({
        id: randomUUID(), tenant_uid: context.tenantUid, document_id: document.id, revision: 1,
        extract_digest: manifestDigest([text]), extract_config: JSON.stringify({ title, mime }), created_at: new Date(),
      });
      for (const piece of pieces) {
        await this.chunks.create({
          id: randomUUID(), tenant_uid: context.tenantUid, document_revision_id: revision.id,
          ordinal: piece.ordinal, text_ref: piece.text, provenance: JSON.stringify({ baseId, title }),
          tokens: piece.text.split(/\s+/).length, content_hash: manifestDigest([piece.text]), created_at: new Date(),
        });
      }
      return { documentId: document.id, chunks: pieces.length };
    } catch (error) { this.mapError(error); }
  }

  async searchBases(tenantUid: number, baseIds: string[], query: string) {
    const rows = await this.chunks.findAll({ where: { tenant_uid: tenantUid } });
    const allowed = new Set(baseIds);
    return lexicalRetrieve(query, rows.flatMap(row => {
      let baseId = '';
      try { baseId = JSON.parse(row.provenance).baseId; } catch { baseId = ''; }
      return allowed.has(baseId) ? [{ id: row.id, text: row.text_ref, allowed: true }] : [];
    }));
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
