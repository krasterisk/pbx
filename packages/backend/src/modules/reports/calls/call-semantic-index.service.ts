import { Inject, Injectable, Optional, OnModuleDestroy } from "@nestjs/common";
import type { Transaction } from "sequelize";
import { createHash } from "node:crypto";
import {
  getSharedNomicEmbedder,
  NOMIC_MODEL,
  NOMIC_EMBED_DIM,
  encodeVector,
  decodeVector,
  cosineSimilarity,
  type TextEmbedder,
} from "../../embeddings/nomic-embed";
import { DashboardReadStore } from "../../dashboard/dashboard-read-store.service";
import { DashboardAccessService } from "../../dashboard/dashboard-access.service";
import { ProductAccessService } from "../../product-access/product-access.service";
import type { JwtPayloadUser } from "../../auth/auth.service";
import type { CallFact } from "../../calls/call-record";
import { callsWhere } from "./calls-query";
import { transcriptContext, TRANSCRIPT_SOURCE } from "./transcript-source";
import type { SemanticWindow } from "./call-semantic-windows";
import { Interval } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { rankCallSemanticCandidates } from "./call-semantic-ranking";

export const CDR_EMBEDDER_FACTORY = "CDR_EMBEDDER_FACTORY";
export type SemanticQuery = {
  embedder: TextEmbedder;
  vector: Float32Array;
  text: string;
};
export function validSemanticVector(
  vector: Float32Array,
  dim: number,
): boolean {
  if (vector.length !== dim || ![...vector].every(Number.isFinite))
    return false;
  const norm = [...vector].reduce((sum, x) => sum + x * x, 0);
  return Math.abs(norm - 1) < 0.02;
}
@Injectable()
export class CallSemanticIndexService implements OnModuleDestroy {
  private readonly pending = new Map<
    string,
    {
      user: JwtPayloadUser;
      tenant: number;
      window: SemanticWindow;
      embedder: TextEmbedder;
    }
  >();
  private active: Promise<void> | null = null;
  private stopped = false;
  private busyId: string | null = null;
  private sweeping = false;
  private readonly failures = new Set<string>();
  constructor(
    private readonly store: DashboardReadStore,
    private readonly access: DashboardAccessService,
    private readonly products: ProductAccessService,
    @Optional()
    @Inject(CDR_EMBEDDER_FACTORY)
    private readonly factory?: () => Promise<TextEmbedder | null>,
    @Optional() private readonly config?: ConfigService,
  ) {}
  previewEnabled(): boolean {
    const value = this.config?.get<unknown>("CDR_SEMANTIC_PREVIEW_ENABLED");
    return value === true || value === "1" || value === "true";
  }

  async prepare(text: string): Promise<SemanticQuery | null> {
    const embedder = await (this.factory || getSharedNomicEmbedder)();
    // hashed_bow is a test/lexical fallback, never a semantic search profile.
    if (
      !embedder ||
      embedder.model !== NOMIC_MODEL ||
      embedder.profile !== "nomic-embed-text-v1.5" ||
      embedder.dim !== NOMIC_EMBED_DIM
    )
      return null;
    const vector = await embedder.embed(text, true);
    if (!validSemanticVector(vector, embedder.dim)) return null;
    return { embedder, vector, text };
  }
  key(tenant: number, window: SemanticWindow, embedder: TextEmbedder): string {
    return createHash("sha256")
      .update(
        JSON.stringify([
          "cdr-semantic-v1",
          tenant,
          window.callId,
          window.nodeId,
          window.runId,
          window.transcriptId,
          window.segmentId,
          window.contentHash,
          embedder.model,
          embedder.profile,
          embedder.dim,
        ]),
      )
      .digest("hex");
  }
  async rank(
    tenant: number,
    query: SemanticQuery,
    windows: SemanticWindow[],
    transaction: Transaction,
  ) {
    const keyed = new Map(
      windows.map((window) => [
        this.key(tenant, window, query.embedder),
        window,
      ]),
    );
    const stored = keyed.size
      ? await this.store.select<{
          id: string;
          profile: string;
          dimension: number | string;
          content_hash: string;
          vector_ref: string;
        }>(
          `SELECT id,profile,dimension,content_hash,vector_ref FROM call_semantic_windows WHERE tenant=:tenant AND id IN (:ids)`,
          { tenant, ids: [...keyed.keys()] },
          transaction,
        )
      : [];
    const indexed = new Set<string>(),
      candidates: Array<{
        value: SemanticWindow;
        text: string;
        cosine: number;
        group: string;
      }> = [];
    for (const row of stored) {
      const window = keyed.get(row.id);
      if (
        !window ||
        row.profile !== query.embedder.profile ||
        Number(row.dimension) !== query.embedder.dim ||
        row.content_hash !== window.contentHash
      )
        continue;
      const buffer = Buffer.from(row.vector_ref, "base64");
      if (
        buffer.length !== query.embedder.dim * 4 ||
        buffer.toString("base64") !== row.vector_ref
      )
        continue;
      const vector = decodeVector(row.vector_ref, query.embedder.dim);
      if (!validSemanticVector(vector, query.embedder.dim)) continue;
      indexed.add(row.id);
      const score = cosineSimilarity(query.vector, vector);
      if (Number.isFinite(score))
        candidates.push({
          value: window,
          text: window.text,
          cosine: score,
          group: window.callId,
        });
    }
    const hits = rankCallSemanticCandidates(query.text, candidates).map(
      (candidate) => ({ window: candidate.value, score: candidate.score }),
    );
    hits.sort(
      (a, b) =>
        b.score - a.score ||
        a.window.callId.localeCompare(b.window.callId) ||
        a.window.startMs - b.window.startMs,
    );
    return {
      hits,
      // Broad recall pool for the fact verifier. These are NOT user-visible hits.
      recallCandidates: candidates.filter(candidate => candidate.cosine >= 0.35)
        .sort((a, b) => b.cosine - a.cosine || a.group.localeCompare(b.group))
        .map(candidate => ({ window: candidate.value, score: candidate.cosine })),
      indexed: indexed.size,
      failed: [...keyed.keys()].filter(
        (id) => !indexed.has(id) && this.failures.has(id),
      ).length,
      missing: [...keyed]
        .filter(([id]) => !indexed.has(id))
        .map(([, window]) => window),
    };
  }
  enqueue(
    user: JwtPayloadUser,
    tenant: number,
    windows: SemanticWindow[],
    embedder: TextEmbedder,
  ): void {
    if (this.stopped) return;
    for (const window of windows.slice(0, 16)) {
      if (this.pending.size >= 64) break;
      const id = this.key(tenant, window, embedder);
      if (!this.pending.has(id) && this.busyId !== id)
        this.pending.set(id, { user, tenant, window, embedder });
    }
    this.kick();
  }
  private kick(): void {
    if (!this.stopped && !this.active && this.pending.size) {
      // Yield until the request transaction/audit has committed; CPU never runs in it.
      this.active = new Promise<void>((resolve) => setImmediate(resolve))
        .then(() => this.drain())
        .finally(() => {
          this.active = null;
          this.kick();
        });
    }
  }
  async whenIdle(): Promise<void> {
    while (this.active) await this.active;
  }
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    this.pending.clear();
    await this.whenIdle();
  }

  private async authorized(
    user: JwtPayloadUser,
    tenant: number,
    window: SemanticWindow,
    transaction: Transaction,
  ): Promise<boolean> {
    const ctx = await transcriptContext(this.access, this.products, user);
    if (ctx.tenant !== tenant) return false;
    const filter = callsWhere(
      tenant,
      {},
      { from: 0, to: Date.now() + 1 },
      ctx.scope,
      this.store.sequelize.getDialect?.() || 'mysql',
    );
    const [call] = await this.store.select<{
      node_id: string;
      payload: string;
    }>(
      `SELECT c.node_id,f.payload FROM dashboard_calls c JOIN call_facts f ON f.call_key=c.call_key AND f.tenant=c.tenant WHERE ${filter.sql} AND c.call_key=:callId`,
      { ...filter.args, callId: window.callId },
      transaction,
    );
    if (!call || call.node_id !== window.nodeId) return false;
    const fact = JSON.parse(call.payload) as CallFact,
      ids = [...new Set([fact.linkedid, ...fact.uniqueids].filter(Boolean))];
    if (!ids.length || ids.length > 10000) return false;
    const rows = await this.store.select(
      `SELECT a.id ${TRANSCRIPT_SOURCE} AND a.id=:run AND a.transcript_id=:transcript AND r.node_id=:node AND (r.source_id IN (:ids) OR r.linkedid IN (:ids)) LIMIT 1`,
      {
        tenant,
        userId: ctx.user.sub,
        now: new Date(),
        run: window.runId,
        transcript: window.transcriptId,
        node: window.nodeId,
        ids,
      },
      transaction,
    );
    return rows.length > 0;
  }
  private async drain(): Promise<void> {
    while (!this.stopped && this.pending.size) {
      const [id, job] = this.pending.entries().next().value!;
      this.pending.delete(id);
      this.busyId = id;
      try {
        const vector = await job.embedder.embed(job.window.text, false);
        if (this.stopped) continue;
        if (!validSemanticVector(vector, job.embedder.dim))
          throw new Error("invalid_embedding");
        await this.store.sequelize.transaction(async (transaction) => {
          if (
            !(await this.authorized(
              job.user,
              job.tenant,
              job.window,
              transaction,
            ))
          )
            return;
          await this.store.upsert(
            "call_semantic_windows",
            {
              id,
              tenant: job.tenant,
              call_key: job.window.callId,
              run_id: job.window.runId,
              transcript_id: job.window.transcriptId,
              segment_id: job.window.segmentId,
              content_hash: job.window.contentHash,
              profile: job.embedder.profile,
              dimension: job.embedder.dim,
              vector_ref: encodeVector(vector),
              created_at: Date.now(),
            },
            ["id"],
            transaction,
          );
        });
        this.failures.delete(id);
      } catch {
        if (this.failures.size >= 512)
          this.failures.delete(this.failures.values().next().value!);
        this.failures.add(id);
      } finally {
        this.busyId = null;
      }
    }
  }
  async purge(tenant: number, transaction: Transaction): Promise<void> {
    // Never purge another tenant or on membership loss: other granted readers may still use the vector.
    await this.store.execute(
      `DELETE FROM call_semantic_windows WHERE tenant=:tenant AND NOT EXISTS (SELECT 1 FROM sa_transcripts t JOIN ai_media_assets asset ON asset.id=t.asset_id AND asset.vpbx_user_uid=t.vpbx_user_uid WHERE t.id=call_semantic_windows.transcript_id AND t.vpbx_user_uid=:tenant AND asset.state='ready' AND asset.deleted_at IS NULL AND (asset.retention_at IS NULL OR asset.retention_at>:now))`,
      { tenant, now: new Date() },
      transaction,
    );
  }
  @Interval(60000)
  async purgeExpired(): Promise<void> {
    if (this.stopped || this.sweeping) return;
    this.sweeping = true;
    try {
      const rows = await this.store.select<{ id: string }>(
        `SELECT w.id FROM call_semantic_windows w LEFT JOIN sa_transcripts t ON t.id=w.transcript_id AND t.vpbx_user_uid=w.tenant LEFT JOIN ai_media_assets asset ON asset.id=t.asset_id AND asset.vpbx_user_uid=w.tenant WHERE asset.id IS NULL OR asset.state<>'ready' OR asset.deleted_at IS NOT NULL OR (asset.retention_at IS NOT NULL AND asset.retention_at<=:now) LIMIT 500`,
        { now: new Date() },
      );
      if (rows.length)
        await this.store.execute(
          `DELETE FROM call_semantic_windows WHERE id IN (:ids) AND NOT EXISTS (SELECT 1 FROM sa_transcripts t JOIN ai_media_assets asset ON asset.id=t.asset_id AND asset.vpbx_user_uid=t.vpbx_user_uid WHERE t.id=call_semantic_windows.transcript_id AND t.vpbx_user_uid=call_semantic_windows.tenant AND asset.state='ready' AND asset.deleted_at IS NULL AND (asset.retention_at IS NULL OR asset.retention_at>:now))`,
          { ids: rows.map((row) => row.id), now: new Date() },
        );
    } catch {
      /* A missing migration/source is surfaced by semantic queries; maintenance retries next minute. */
    } finally {
      this.sweeping = false;
    }
  }
}
