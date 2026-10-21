import {
  BadRequestException,
  Injectable,
  Optional,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Transaction } from "sequelize";
import { createHash } from "node:crypto";
import type { CallsQuery, CallTextSearchPage } from "@krasterisk/shared";
import type { JwtPayloadUser } from "../../auth/auth.service";
import { DashboardAccessService } from "../../dashboard/dashboard-access.service";
import { DashboardReadStore } from "../../dashboard/dashboard-read-store.service";
import { DashboardCloudService } from "../../dashboard/dashboard-cloud.service";
import { ProductAccessService } from "../../product-access/product-access.service";
import { ActionLog } from "../../logger/action-log.model";
import type { CallFact } from "../../calls/call-record";
import { callsPeriod, callsWhere } from "./calls-query";
import { TRANSCRIPT_SOURCE, transcriptContext } from "./transcript-source";
import { CallSemanticIndexService } from "./call-semantic-index.service";
import { semanticWindows, type SemanticWindow } from "./call-semantic-windows";
import { CallSemanticGroundingService } from "./call-semantic-grounding.service";
import { saTextPrivacyEnabled } from '@krasterisk/shared';
import { callTranscriptSpeaker } from './call-transcript-speaker';
import {
  CDR_GROUNDING_LIMITS,
  CDR_GROUNDING_PROFILE,
  type CallEvidenceCandidate,
} from "./call-semantic-grounding";

export function normalizePhrase(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}
const limits = { calls: 200, segments: 5000, segmentChars: 5000, matches: 100 };
function publishedPrivacy(raw: string | undefined | null) {
  if(raw===undefined || raw===null) return false;
  const config=JSON.parse(raw);
  if(!config || typeof config!=='object' || Array.isArray(config)) throw new Error('project_config_invalid');
  return saTextPrivacyEnabled(config);
}
@Injectable()
export class CallTextSearchService {
  constructor(
    private readonly access: DashboardAccessService,
    private readonly store: DashboardReadStore,
    private readonly cloud: DashboardCloudService,
    private readonly products: ProductAccessService,
    @InjectModel(ActionLog) private readonly audit: typeof ActionLog,
    @Optional() private readonly semantic?: CallSemanticIndexService,
    @Optional() private readonly grounding?: CallSemanticGroundingService,
  ) {}

  async search(
    user: JwtPayloadUser,
    query: CallsQuery,
    input: string,
    mode: "literal" | "semantic" = "literal",
  ): Promise<CallTextSearchPage> {
    if (typeof input !== "string" || input.length > 200)
      throw new BadRequestException("Invalid phrase");
    const phrase = normalizePhrase(input);
    if (phrase.length < 2)
      throw new BadRequestException(
        "Phrase must contain at least two characters",
      );
    const ctx = await transcriptContext(this.access, this.products, user);
    if (!["literal", "semantic"].includes(mode))
      throw new BadRequestException("Invalid search mode");
    if (mode === "semantic" && !this.semantic?.previewEnabled())
      throw new ForbiddenException("Semantic preview is not enabled");
    const timezone = await this.cloud.timezone(ctx.tenant),
      period = callsPeriod(query, timezone);
    const filter = callsWhere(
      ctx.tenant,
      { ...query, cursor: undefined, limit: undefined },
      period,
      ctx.scope,
      this.store.sequelize.getDialect?.() || 'mysql',
    );
    const semanticQuery =
      mode === "semantic" && this.semantic
        ? await this.semantic.prepare(input).catch(() => null)
        : null;
    let pending: SemanticWindow[] = [];
    let evidenceCandidates: CallEvidenceCandidate[] = [];
    let snapshotHash = "",
      expectedSnapshotHash: string | undefined;
    let grounded:
      | Awaited<ReturnType<CallSemanticGroundingService["verify"]>>
      | undefined;
    try {
      const readSnapshot = () =>
        this.store.sequelize.transaction<CallTextSearchPage>(
          { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
          async (transaction) => {
            const [count] = await this.store.select<{
              amount: string | number;
            }>(
              `SELECT COUNT(*) AS amount FROM dashboard_calls c JOIN call_facts f ON f.call_key=c.call_key AND f.tenant=c.tenant WHERE ${filter.sql}`,
              filter.args,
              transaction,
            );
            const calls = await this.store.select<{
              call_key: string;
              node_id: string;
              payload: string;
              started_at: string | number;
            }>(
              `SELECT c.call_key,c.node_id,c.started_at,f.payload FROM dashboard_calls c JOIN call_facts f ON f.call_key=c.call_key AND f.tenant=c.tenant WHERE ${filter.sql} ORDER BY c.started_at DESC,c.call_key DESC LIMIT 200`,
              filter.args,
              transaction,
            );
            const reasons = new Set<
              CallTextSearchPage["partialReasons"][number]
            >();
            if (Number(count.amount) > calls.length) reasons.add("call_limit");
            const identities = new Map<string, Set<string>>(),
              byIdentity = new Map<string, Set<string>>();
            let identityCount = 0;
            const facts = new Map<string, CallFact>();
            for (const call of calls) {
              const fact = JSON.parse(call.payload) as CallFact;
              facts.set(call.call_key, fact);
              const ids = [
                ...new Set([fact.linkedid, ...fact.uniqueids].filter(Boolean)),
              ];
              if (!ids.length || identityCount + ids.length > 10000) {
                reasons.add("identity_limit");
                continue;
              }
              identityCount += ids.length;
              for (const id of ids) {
                if (!identities.has(call.node_id))
                  identities.set(call.node_id, new Set());
                identities.get(call.node_id)!.add(id);
                const key = JSON.stringify([call.node_id, id]);
                if (!byIdentity.has(key)) byIdentity.set(key, new Set());
                byIdentity.get(key)!.add(call.call_key);
              }
            }
            const args: Record<string, unknown> = {
              tenant: ctx.tenant,
              userId: ctx.user.sub,
              now: new Date(),
            };
            const predicates = [...identities].map(([node, ids], i) => {
              args[`node${i}`] = node;
              args[`ids${i}`] = [...ids];
              return `(r.node_id=:node${i} AND (r.source_id IN (:ids${i}) OR r.linkedid IN (:ids${i})))`;
            });
            const runs = predicates.length
              ? await this.store.select<{
                  run_id: string;
                  transcript_id: string;
                  node_id: string;
                  source_id: string;
                  linkedid: string | null;
                  project_config?: string;
                  current_project_config?: string | null;
                  active_version_id?: string | null;
                  privacy_evidence?: string;
                }>(
                  `SELECT DISTINCT a.id AS run_id,a.transcript_id,a.created_at,r.node_id,r.source_id,r.linkedid,v.config AS project_config,result.evidence_refs AS privacy_evidence,p.active_version_id,(SELECT pv.config FROM sa_project_versions pv WHERE pv.id=p.active_version_id AND pv.project_id=p.id AND pv.vpbx_user_uid=p.vpbx_user_uid) AS current_project_config ${TRANSCRIPT_SOURCE} AND (${predicates.join(" OR ")}) ORDER BY a.created_at DESC,a.id DESC LIMIT 5001`,
                  args,
                  transaction,
                )
              : [];
            if (runs.length > 5000) reasons.add("run_limit");
            const chosen = new Map<string, (typeof runs)[number]>();
            for (const run of runs.slice(0, 5000)) {
              const targets = new Set([
                ...(byIdentity.get(
                  JSON.stringify([run.node_id, run.source_id]),
                ) || []),
                ...(byIdentity.get(
                  JSON.stringify([run.node_id, run.linkedid]),
                ) || []),
              ]);
              for (const id of targets)
                if (!chosen.has(id)) chosen.set(id, run);
            }
            const transcriptIds = [
              ...new Set([...chosen.values()].map((run) => run.transcript_id)),
            ];
            const segments = transcriptIds.length
              ? await this.store.select<{
                  id: string;
                  transcript_id: string;
                  ordinal: string | number;
                  start_ms: string | number;
                  end_ms: string | number;
                  speaker_role: string;
                  text: string;
                }>(
                  `SELECT id,transcript_id,ordinal,start_ms,end_ms,speaker_role,SUBSTRING(text,1,5001) AS text FROM sa_transcript_segments WHERE vpbx_user_uid=:tenant AND transcript_id IN (:transcripts) ORDER BY transcript_id,ordinal,id LIMIT 5001`,
                  { tenant: ctx.tenant, transcripts: transcriptIds },
                  transaction,
                )
              : [];
            if (segments.length > limits.segments) reasons.add("segment_limit");
            snapshotHash = createHash("sha256")
              .update(JSON.stringify([calls, [...chosen], segments]))
              .digest("hex");
            if (expectedSnapshotHash && snapshotHash !== expectedSnapshotHash)
              throw new Error("CDR_GROUNDING_SOURCE_CHANGED");
            if (
              segments
                .slice(0, limits.segments)
                .some((segment) => segment.text.length > limits.segmentChars)
            )
              reasons.add("segment_text_limit");
            const rows: CallTextSearchPage["rows"] = [];
            let matchingSegments = 0;
            let semantic: CallTextSearchPage["semantic"];
            if (mode === "semantic") {
              if (!semanticQuery || !this.semantic)
                semantic = {
                  state: "unavailable",
                  model: null,
                  profile: null,
                  dimension: null,
                  indexedWindows: 0,
                  totalWindows: 0,
                };
              else {
                const windows: SemanticWindow[] = [];
                for (const call of calls) {
                  const run = chosen.get(call.call_key);
                  if (!run) continue;
                  windows.push(
                    ...semanticWindows(
                      call.call_key,
                      call.node_id,
                      run.run_id,
                      run.transcript_id,
                      segments
                        .slice(0, limits.segments)
                        .filter((s) => s.transcript_id === run.transcript_id),
                    ),
                  );
                }
                if (windows.length > 200) reasons.add("window_limit");
                if (windows.some((window) => window.truncated))
                  reasons.add("window_text_limit");
                await this.semantic.purge(ctx.tenant, transaction);
                const ranked = await this.semantic.rank(
                  ctx.tenant,
                  semanticQuery,
                  windows.slice(0, 200),
                  transaction,
                );
                pending = ranked.missing;
                if (pending.length) reasons.add("indexing");
                semantic = {
                  state: ranked.failed
                    ? "error"
                    : pending.length
                      ? "indexing"
                      : "ready",
                  model: semanticQuery.embedder.model,
                  profile: semanticQuery.embedder.profile,
                  dimension: semanticQuery.embedder.dim,
                  indexedWindows: ranked.indexed,
                  totalWindows: Math.min(windows.length, 200),
                };
                // Vectors retrieve candidates; only source-grounded facts become results.
                const shortlisted = [
                  ...new Set(
                    ranked.recallCandidates.map((hit) => hit.window.callId),
                  ),
                ];
                // A narrow authorized cohort fits the verifier budget in full.
                // Low vector similarity for dates/numbers must not discard it
                // before factual verification. These are never direct results.
                if (ranked.indexed > 0 && !ranked.failed && !pending.length && chosen.size <= CDR_GROUNDING_LIMITS.calls) {
                  for (const id of chosen.keys()) if (!shortlisted.includes(id)) shortlisted.push(id);
                }
                if (shortlisted.length > CDR_GROUNDING_LIMITS.calls)
                  reasons.add("verification_limit");
                evidenceCandidates = [];
                let evidenceChars = 0;
                for (const id of shortlisted.slice(
                  0,
                  CDR_GROUNDING_LIMITS.calls,
                )) {
                  const run = chosen.get(id)!;
                  if(run.active_version_id && !run.current_project_config) throw new Error('project_config_unavailable');
                  const source = segments
                    .slice(0, limits.segments)
                    .filter(
                      (segment) => segment.transcript_id === run.transcript_id,
                    );
                  const chars = source.reduce(
                    (sum, segment) => sum + segment.text.length,
                    0,
                  );
                  // Never infer absence using a transcript cut off by a segment/text cap.
                  const cutOff =
                    segments.length > limits.segments &&
                    source.some(
                      (segment) => segment === segments[limits.segments - 1],
                    );
                  if (
                    !source.length ||
                    cutOff ||
                    source.length > CDR_GROUNDING_LIMITS.segments ||
                    source.some(
                      (segment) =>
                        segment.text.length > CDR_GROUNDING_LIMITS.segmentChars,
                    ) ||
                    evidenceChars + chars > CDR_GROUNDING_LIMITS.totalChars
                  ) {
                    reasons.add("verification_limit");
                    continue;
                  }
                  evidenceChars += chars;
                  evidenceCandidates.push({
                    callId: id,
                    anonymizeBeforeLlm: publishedPrivacy(run.project_config)
                      || publishedPrivacy(run.current_project_config),
                    privacyEvidence: JSON.parse(run.privacy_evidence || '[]'),
                    context: {
                      startedAt: new Date(
                        Number(
                          calls.find((call) => call.call_key === id)!
                            .started_at,
                        ),
                      ).toISOString(),
                      timezone,
                    },
                    segments: source.map((segment) => ({
                      id: segment.id,
                      ordinal: Number(segment.ordinal),
                      text: segment.text,
                      startMs: Number(segment.start_ms),
                      endMs: Number(segment.end_ms),
                      speaker: callTranscriptSpeaker(segment.speaker_role),
                    })),
                  });
                }
                if (grounded) {
                  if (grounded.privacyLimited) reasons.add('privacy_limited');
                  semantic.verification = {
                    providerUid: grounded.providerUid,
                    model: grounded.model,
                    profile: CDR_GROUNDING_PROFILE,
                  };
                  const seen = new Set<string>();
                  for (const match of grounded.matches) {
                    const source = evidenceCandidates.find(
                      (candidate) => candidate.callId === match.callId,
                    );
                    const anchor = source?.segments.find(
                      (segment) => segment.id === match.evidence[0]?.segmentId,
                    );
                    const call = calls.find(
                      (candidate) => candidate.call_key === match.callId,
                    );
                    const run = chosen.get(match.callId);
                    if (
                      !source ||
                      !anchor ||
                      !call ||
                      !run ||
                      typeof anchor.startMs !== "number" ||
                      typeof anchor.endMs !== "number"
                    )
                      throw new Error("CDR_GROUNDING_SOURCE_CHANGED");
                    for (const evidence of match.evidence)
                      seen.add(
                        JSON.stringify([match.callId, evidence.segmentId]),
                      );
                    rows.push({
                      callId: match.callId,
                      caller: facts.get(match.callId)!.caller,
                      recipient: facts.get(match.callId)!.recipient,
                      startedAt: new Date(
                        Number(call.started_at),
                      ).toISOString(),
                      runId: run.run_id,
                      transcriptId: run.transcript_id,
                      segmentId: anchor.id,
                      startMs: anchor.startMs,
                      endMs: anchor.endMs,
                      speaker: anchor.speaker,
                      snippet: match.evidence
                        .map((evidence) => evidence.quote)
                        .join(" … ")
                        .slice(0, 600),
                    });
                  }
                  matchingSegments = seen.size;
                }
              }
            }
            for (const segment of mode === "literal"
              ? segments.slice(0, limits.segments)
              : []) {
              if (segment.text.length > limits.segmentChars)
                reasons.add("segment_text_limit");
              const display = segment.text
                .slice(0, limits.segmentChars)
                .normalize("NFKC")
                .replace(/\s+/gu, " ")
                .trim();
              const text = display.toLowerCase(),
                at = text.indexOf(phrase);
              if (at < 0) continue;
              matchingSegments++;
              for (const call of calls) {
                const run = chosen.get(call.call_key);
                if (run?.transcript_id !== segment.transcript_id) continue;
                if (rows.length >= limits.matches) {
                  reasons.add("match_limit");
                  continue;
                }
                rows.push({
                  callId: call.call_key,
                  caller: facts.get(call.call_key)!.caller,
                  recipient: facts.get(call.call_key)!.recipient,
                  startedAt: new Date(Number(call.started_at)).toISOString(),
                  runId: run.run_id,
                  transcriptId: run.transcript_id,
                  segmentId: segment.id,
                  startMs: Number(segment.start_ms),
                  endMs: Number(segment.end_ms),
                  speaker: callTranscriptSpeaker(segment.speaker_role),
                  snippet:
                    (at > 80 ? "…" : "") +
                    display.slice(
                      Math.max(0, at - 80),
                      at + phrase.length + 120,
                    ) +
                    (at + phrase.length + 120 < display.length ? "…" : ""),
                });
              }
            }
            // No query text or conversation content in the audit payload.
            if (mode === "literal" || grounded || !evidenceCandidates.length)
              await this.audit.create(
                {
                  user_id: ctx.user.sub,
                  user_uid: ctx.tenant,
                  action: "call_transcript_search",
                  entity_type: "call",
                  entity_id: null,
                  details: JSON.stringify({
                    phraseLength: phrase.length,
                    mode,
                    calls: calls.length,
                    eligible: chosen.size,
                    matches: rows.length,
                    partialReasons: [...reasons],
                    ...(grounded
                      ? {
                          verificationProfile: CDR_GROUNDING_PROFILE,
                          llmProviderUid: grounded.providerUid,
                        }
                      : {}),
                  }),
                  status: "success",
                },
                { transaction },
              );
            return {
              mode,
              ...(semantic ? { semantic } : {}),
              rows,
              timezone,
              period: {
                from: new Date(period.from).toISOString(),
                to: new Date(period.to).toISOString(),
              },
              dataAsOf: new Date().toISOString(),
              coverage: {
                cohortCalls: Number(count.amount),
                consideredCalls: calls.length,
                eligibleCalls: chosen.size,
                scannedSegments: Math.min(segments.length, limits.segments),
                matchingSegments,
              },
              partialReasons: [...reasons],
              limits,
            };
          },
        );
      let result = await readSnapshot();
      if (mode === "semantic" && evidenceCandidates.length) {
        if (!this.grounding)
          throw new Error("CDR_GROUNDING_PROVIDER_UNAVAILABLE");
        expectedSnapshotHash = snapshotHash;
        // The first SQL transaction is closed before external inference starts.
        grounded = await this.grounding.verify(input, evidenceCandidates);
        const fresh = await transcriptContext(this.access, this.products, user);
        if ((await this.cloud.timezone(ctx.tenant)) !== timezone)
          throw new Error("CDR_GROUNDING_TIMEZONE_CHANGED");
        if (
          fresh.tenant !== ctx.tenant ||
          fresh.user.sub !== ctx.user.sub ||
          JSON.stringify(fresh.scope) !== JSON.stringify(ctx.scope) ||
          JSON.stringify([...fresh.pages].sort()) !==
            JSON.stringify([...ctx.pages].sort())
        )
          throw new ForbiddenException("Transcript access changed");
        // Fresh whole-call/project/source ACL, retention, run and content snapshot;
        // audit and final quoted rows are created only in this second transaction.
        result = await readSnapshot();
      }
      if (semanticQuery && pending.length)
        this.semantic!.enqueue(
          ctx.user,
          ctx.tenant,
          pending,
          semanticQuery.embedder,
        );
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === 'CDR_GROUNDING_QUERY_REDACTED')
        throw new ServiceUnavailableException({code: 'CDR_SEARCH_QUERY_REDACTED', message: 'Search conditions were fully redacted; rephrase or use exact phrase search'});
      throw new ServiceUnavailableException(
        "Transcript search is temporarily unavailable",
        { cause: error },
      );
    }
  }
}
