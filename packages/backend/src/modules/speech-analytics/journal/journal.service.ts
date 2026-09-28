import {
  ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { randomUUID } from 'node:crypto';
import type { TenantContext } from '../../integration-credentials/tenant-context';
import {
  isCdrUnrestricted,
  parseCdrAccessBlob,
  type CdrAccessScope,
} from '../../reports/cdr/cdr-access-scope';
import { normalizeAccessToken } from '../../callcenter/callcenter-access-list.util';
import { User, UserLevel } from '../../users/user.model';
import { NumberList } from '../../numbers/number-list.model';
import {
  SaAnalysisRun, SaProject, SaRecording, SaResult, SaTranscript, SaTranscriptSegment,
} from '../speech-analytics.models';
import { readJournalColumns } from './journal-row-view';
import { SaRecordingRelation } from '../reporting/reporting.models';
import { SaHumanReview } from '../metrics/metric.models';
import {
  buildJournalExcel,
  filterExportRowsByAccess,
  type JournalExcelHeaderLabels,
  type JournalExcelRow,
} from './excel-export';

export interface JournalRowAccessFields {
  id: string;
  operatorExten: string | null;
  operatorName: string | null;
  uploadedByUserId: number | null;
  sourceKind: string;
}

export interface JournalViewer {
  userId: number;
  level: number;
}

type WalletSeam = {
  refund: (...args: unknown[]) => unknown;
  settleShadow: (...args: unknown[]) => unknown;
};

export function canMutateConversation(level: number): boolean {
  return level === UserLevel.ADMIN || level === UserLevel.SUPERADMIN;
}

export function canEditConversationScores(level: number): boolean {
  return level === UserLevel.SUPERVISOR
    || level === UserLevel.ADMIN
    || level === UserLevel.SUPERADMIN;
}

export function isJournalRowVisible(
  row: JournalRowAccessFields,
  scope: CdrAccessScope | null,
  viewer: JournalViewer,
): boolean {
  if (viewer.level === UserLevel.ADMIN || viewer.level === UserLevel.SUPERADMIN) {
    return true;
  }
  if (!scope || isCdrUnrestricted(scope)) {
    return true;
  }

  const allowed = new Set(
    [...scope.operators, scope.ownExten].filter(Boolean).map((v) => normalizeAccessToken(String(v))),
  );
  if (row.operatorExten && allowed.has(normalizeAccessToken(row.operatorExten))) {
    return true;
  }
  if (row.uploadedByUserId != null && row.uploadedByUserId === viewer.userId) {
    return true;
  }
  return false;
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function taxonomyNames(configText: unknown): Map<string, string> {
  const names = new Map<string, string>();
  if (typeof configText !== 'string' || !configText.trim()) return names;
  try {
    const parsed = JSON.parse(configText) as { callTaxonomy?: Array<{ id?: unknown; name?: unknown }> };
    for (const tag of parsed.callTaxonomy ?? []) {
      if (typeof tag.id === 'string' && typeof tag.name === 'string' && tag.name.trim()) {
        names.set(tag.id, tag.name.trim());
      }
    }
  } catch {
    return names;
  }
  return names;
}

function runHasResult(run: { state: string; result_id: string | null }): boolean {
  return Boolean(run.result_id) && (run.state === 'completed' || run.state === 'succeeded');
}

function runStamp(run: { updated_at?: Date | string | null; created_at?: Date | string | null }): number {
  const raw = run.updated_at ?? run.created_at;
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function accessFieldsFromRecording(
  recording: SaRecording,
  sourceKind: string,
): JournalRowAccessFields {
  const meta = parseMetadata(recording.metadata);
  const operatorExten = meta.operatorExten != null ? String(meta.operatorExten) : null;
  const operatorName = meta.operatorName != null ? String(meta.operatorName) : null;
  const uploadedByUserId = Number.isFinite(Number(meta.uploadedByUserId))
    ? Number(meta.uploadedByUserId)
    : null;
  return {
    id: recording.id,
    operatorExten,
    operatorName,
    uploadedByUserId,
    sourceKind,
  };
}

@Injectable()
export class SaJournalService {
  /** Test-only seam - production never wires a wallet (D-13 no refund). */
  wallet: WalletSeam = {
    refund: () => undefined,
    settleShadow: () => undefined,
  };

  constructor(
    @InjectModel(SaRecording) private readonly recordings: typeof SaRecording,
    @InjectModel(SaAnalysisRun) private readonly runs: typeof SaAnalysisRun,
    @InjectModel(SaResult) private readonly results: typeof SaResult,
    @InjectModel(SaTranscript) private readonly transcripts: typeof SaTranscript,
    @InjectModel(SaTranscriptSegment) private readonly segments: typeof SaTranscriptSegment,
    @InjectModel(SaRecordingRelation) private readonly relations: typeof SaRecordingRelation,
    @InjectModel(SaHumanReview) private readonly reviews: typeof SaHumanReview,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(NumberList) private readonly numberLists: typeof NumberList,
    @InjectModel(SaProject) private readonly projects: typeof SaProject,
  ) {}

  private principalUserId(context: TenantContext): number {
    const match = /^user:(\d+)$/.exec(context.principalId);
    if (!match) throw new ForbiddenException({ code: 'journal_user_required' });
    return Number(match[1]);
  }

  private async resolveViewer(context: TenantContext): Promise<JournalViewer> {
    const userId = this.principalUserId(context);
    const user = await this.users.findOne({
      where: { uniqueid: userId },
      attributes: ['uniqueid', 'level', 'numbers_id', 'exten', 'login'],
    });
    if (!user) throw new ForbiddenException({ code: 'journal_user_required' });
    return { userId, level: Number(user.getDataValue('level')) };
  }

  private async resolveCdrScope(viewer: JournalViewer): Promise<CdrAccessScope | null> {
    if (viewer.level === UserLevel.ADMIN || viewer.level === UserLevel.SUPERADMIN) {
      return null;
    }
    const user = await this.users.findOne({
      where: { uniqueid: viewer.userId },
      attributes: ['uniqueid', 'numbers_id', 'exten', 'login', 'level'],
    });
    if (!user) return { operators: [], queues: [], ownExten: null };

    const numbersId = user.getDataValue('numbers_id') as number | null | undefined;
    if (!numbersId || numbersId <= 0) {
      return { operators: [], queues: [], ownExten: null };
    }

    const list = await this.numberLists.findOne({
      where: { id: numbersId },
      attributes: ['numbers'],
    });
    let blob = list?.getDataValue('numbers') as unknown;
    if (typeof blob === 'string') {
      try { blob = JSON.parse(blob); } catch { blob = null; }
    }
    const parsed = parseCdrAccessBlob(
      blob && typeof blob === 'object' ? (blob as { cdr?: unknown }).cdr : undefined,
    );
    const ownExten =
      normalizeAccessToken(user.getDataValue('exten') as string)
      || (/^\d+$/.test(String(user.getDataValue('login') || ''))
        ? String(user.getDataValue('login'))
        : null);
    return { operators: parsed.operators, queues: parsed.queues, ownExten };
  }

  private assertMutate(viewer: JournalViewer): void {
    if (!canMutateConversation(viewer.level)) {
      throw new ForbiddenException({ code: 'journal_mutate_forbidden' });
    }
  }

  async list(context: TenantContext) {
    const viewer = await this.resolveViewer(context);
    const scope = await this.resolveCdrScope(viewer);
    const recordings = await this.recordings.findAll({
      where: { tenant_uid: context.tenantUid },
      order: [['occurred_at', 'DESC']],
    });
    const relations = await this.relations.findAll({
      where: {
        tenant_uid: context.tenantUid,
        recording_id: { [Op.in]: recordings.map((r) => r.id) },
      },
    });
    const sourceByRecording = new Map(
      relations.map((rel) => [rel.recording_id, rel.source_kind]),
    );
    const visible = recordings.filter((row) => {
      const sourceKind = sourceByRecording.get(row.id) ?? 'upload';
      return isJournalRowVisible(accessFieldsFromRecording(row, sourceKind), scope, viewer);
    });

    const runRows = visible.length === 0
      ? []
      : await this.runs.findAll({
        where: {
          tenant_uid: context.tenantUid,
          recording_id: { [Op.in]: visible.map((r) => r.id) },
        },
        order: [['created_at', 'DESC']],
      });

    const latestByRecording = new Map<string, SaAnalysisRun>();
    const sortedRuns = [...runRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    for (const run of sortedRuns) {
      if (!latestByRecording.has(run.recording_id)) {
        latestByRecording.set(run.recording_id, run);
      }
    }

    const resultIds = [...new Set(
      sortedRuns
        .filter((run) => runHasResult(run))
        .map((run) => run.result_id)
        .filter((id): id is string => Boolean(id)),
    )];
    const resultRows = resultIds.length === 0
      ? []
      : await this.results.findAll({
        where: { tenant_uid: context.tenantUid, id: { [Op.in]: resultIds } },
      });
    const resultById = new Map(resultRows.map((r) => [r.id, r]));
    const projectIds = [...new Set(visible.map((row) => row.project_id).filter((id): id is string => Boolean(id)))];
    const projectRows = projectIds.length === 0
      ? []
      : await this.projects.findAll({
        where: { tenant_uid: context.tenantUid, id: { [Op.in]: projectIds } },
        attributes: ['id', 'name', 'draft_config'],
      });
    const projectNameById = new Map(projectRows.map((project) => [project.id, project.name]));
    const tagNamesByProject = new Map(projectRows.map((project) => [project.id, taxonomyNames(project.draft_config)]));
    const runsByRecording = new Map<string, SaAnalysisRun[]>();
    for (const run of sortedRuns) {
      const bucket = runsByRecording.get(run.recording_id) ?? [];
      bucket.push(run);
      runsByRecording.set(run.recording_id, bucket);
    }
    const displayRun = (recordingId: string) => (
      (runsByRecording.get(recordingId) ?? []).find((run) => runHasResult(run))
    );

    const items = visible.flatMap((row) => {
      const shown = displayRun(row.id);
      if (!shown) return [];
      const sourceKind = sourceByRecording.get(row.id) ?? 'upload';
      const result = shown.result_id ? resultById.get(shown.result_id) : undefined;
      const columns = readJournalColumns({
        metadata: row.metadata,
        audioMs: shown.audio_ms ?? null,
        metricResults: result?.metric_results ?? null,
        quality: result?.quality ?? null,
        projectName: projectNameById.get(row.project_id) ?? null,
        tagNames: tagNamesByProject.get(row.project_id),
      });
      return [{
        id: row.id,
        occurredAt: row.occurred_at?.toISOString?.() ?? String(row.occurred_at),
        sourceKind,
        latestAmount: shown.amount ?? null,
        currency: shown.currency ?? null,
        summary: result?.summary ?? null,
        ...columns,
      }];
    });

    const failedWindowMs = 30 * 60 * 1000;
    const now = Date.now();
    const analysisJobs: Array<{
      id: string;
      filename: string;
      projectName: string | null;
      state: 'queued' | 'running' | 'failed';
      reason: string | null;
    }> = [];
    const activeCreated: number[] = [];
    for (const row of visible) {
      const latest = latestByRecording.get(row.id);
      if (!latest) continue;
      const active = latest.state === 'queued' || latest.state === 'running';
      const recentFailure = latest.state === 'failed' && now - runStamp(latest) < failedWindowMs;
      if (!active && !recentFailure) continue;
      const meta = parseMetadata(row.metadata);
      const filename = typeof meta.filename === 'string' && meta.filename.trim()
        ? meta.filename.trim()
        : row.external_call_id;
      analysisJobs.push({
        id: latest.id,
        filename,
        projectName: projectNameById.get(row.project_id) ?? null,
        state: active ? (latest.state === 'running' ? 'running' : 'queued') : 'failed',
        reason: latest.reason ?? null,
      });
      if (active) activeCreated.push(runStamp(latest));
    }
    let done = 0;
    if (activeCreated.length > 0) {
      const oldest = Math.min(...activeCreated) - 60_000;
      for (const row of visible) {
        const shown = displayRun(row.id);
        if (!shown || runStamp(shown) < oldest) continue;
        done += 1;
      }
    }
    const activeCount = analysisJobs.filter((job) => job.state !== 'failed').length;

    return {
      items,
      total: items.length,
      analysisJobs,
      uploadProgress: {
        done,
        total: activeCount > 0 ? done + activeCount : 0,
      },
    };
  }

  async get(context: TenantContext, id: string) {
    const viewer = await this.resolveViewer(context);
    const scope = await this.resolveCdrScope(viewer);
    const recording = await this.recordings.findOne({
      where: { tenant_uid: context.tenantUid, id },
    });
    if (!recording) throw new NotFoundException({ code: 'resource_not_found' });

    const relation = await this.relations.findAll({
      where: { tenant_uid: context.tenantUid, recording_id: id },
    });
    const sourceKind = relation[0]?.source_kind ?? 'upload';
    if (!isJournalRowVisible(accessFieldsFromRecording(recording, sourceKind), scope, viewer)) {
      throw new NotFoundException({ code: 'resource_not_found' });
    }

    const runs = await this.runs.findAll({
      where: { tenant_uid: context.tenantUid, recording_id: id },
      order: [['created_at', 'DESC']],
    });
    const orderedRuns = [...runs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const latest = orderedRuns[0] ?? null;
    const result = latest?.result_id
      ? await this.results.findAll({
        where: { tenant_uid: context.tenantUid, id: latest.result_id },
      })
      : [];
    const rebuildInProgress = orderedRuns.some((r) => r.state === 'queued' || r.state === 'running');
    let metricResults: unknown[] = [];
    const rawMetrics = result[0]?.metric_results;
    if (rawMetrics) {
      try {
        const parsed = JSON.parse(rawMetrics) as unknown;
        metricResults = Array.isArray(parsed) ? parsed : [];
      } catch {
        metricResults = [];
      }
    }
    const transcriptId = latest?.transcript_id;
    const segmentRows = transcriptId
      ? await this.segments.findAll({
        where: { tenant_uid: context.tenantUid, transcript_id: transcriptId },
        order: [['ordinal', 'ASC']],
      })
      : [];
    const transcriptText = segmentRows.length
      ? segmentRows.map((row) => `${row.speaker_role}: ${row.text}`).join('\n')
      : null;
    const turns = segmentRows.map((row) => ({
      speaker: row.speaker_role,
      text: row.text,
      startMs: Number(row.start_ms),
      endMs: Number(row.end_ms),
    }));

    return {
      id: recording.id,
      sourceKind,
      audioUrl: null as string | null,
      summary: result[0]?.summary ?? null,
      quality: result[0]?.quality ?? null,
      metricResults,
      transcriptText,
      turns,
      rebuildInProgress,
      runs: orderedRuns.map((run) => ({
        id: run.id,
        amount: run.amount,
        currency: run.currency,
        audioMs: run.audio_ms,
        providerTokens: run.provider_tokens,
        createdAt: run.created_at?.toISOString?.() ?? String(run.created_at),
      })),
    };
  }

  async saveOverride(context: TenantContext, id: string, input: {
    metricId: string;
    value: string;
    note?: string;
  }) {
    const viewer = await this.resolveViewer(context);
    this.assertMutate(viewer);
    const recording = await this.recordings.findOne({
      where: { tenant_uid: context.tenantUid, id },
    });
    if (!recording) throw new NotFoundException({ code: 'resource_not_found' });
    const latest = await this.runs.findOne({
      where: { tenant_uid: context.tenantUid, recording_id: id },
      order: [['created_at', 'DESC']],
    });
    if (!latest?.result_id) throw new NotFoundException({ code: 'resource_not_found' });
    const result = await this.results.findOne({
      where: { tenant_uid: context.tenantUid, id: latest.result_id },
    });
    if (!result) throw new NotFoundException({ code: 'resource_not_found' });
    let rows: Array<Record<string, unknown>> = [];
    try {
      const parsed = JSON.parse(result.metric_results) as unknown;
      rows = Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
    } catch {
      rows = [];
    }
    const metricId = input.metricId.trim();
    if (!metricId || metricId.startsWith('_')) {
      throw new NotFoundException({ code: 'resource_not_found' });
    }
    const overrides = rows.filter((row) => row.id === '_overrides');
    const rest = rows.filter((row) => row.id !== '_overrides');
    const current = Array.isArray(overrides[0]?.value) ? overrides[0].value as Array<Record<string, unknown>> : [];
    const kept = current.filter((row) => row.metricId !== metricId);
    const next = input.value.trim()
      ? [...kept, { metricId, value: input.value, note: input.note?.trim() || '' }]
      : kept;
    rest.push({ id: '_overrides', value: next, rationale: '', quote: '' });
    await result.update({ metric_results: JSON.stringify(rest) });
    return { overrides: next };
  }

  async regenerate(context: TenantContext, id: string) {
    const viewer = await this.resolveViewer(context);
    this.assertMutate(viewer);

    const recording = await this.recordings.findOne({
      where: { tenant_uid: context.tenantUid, id },
    });
    if (!recording) throw new NotFoundException({ code: 'resource_not_found' });

    const prior = await this.runs.findOne({
      where: { tenant_uid: context.tenantUid, recording_id: id },
      order: [['created_at', 'DESC']],
    });
    if (!prior) throw new NotFoundException({ code: 'resource_not_found' });

    const created = await this.runs.create({
      id: randomUUID(),
      tenant_uid: context.tenantUid,
      recording_id: id,
      project_version_id: prior.project_version_id,
      job_id: randomUUID(),
      state: 'queued',
      transcript_id: prior.transcript_id,
      result_id: null,
      parent_run_id: prior.id,
      reason: 'regenerate',
      amount: null,
      currency: prior.currency,
      audio_ms: null,
      provider_tokens: null,
      charged: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Manual tags / supervisor reviews are never destroyed on regenerate (D-12).
    return { runId: created.id };
  }

  async delete(context: TenantContext, id: string) {
    const viewer = await this.resolveViewer(context);
    this.assertMutate(viewer);

    const recording = await this.recordings.findOne({
      where: { tenant_uid: context.tenantUid, id },
    });
    if (!recording) throw new NotFoundException({ code: 'resource_not_found' });

    const runs = await this.runs.findAll({
      where: { tenant_uid: context.tenantUid, recording_id: id },
    });
    const runIds = runs.map((r) => r.id);
    const resultIds = runs.map((r) => r.result_id).filter((v): v is string => Boolean(v));
    const transcriptIds = runs.map((r) => r.transcript_id).filter((v): v is string => Boolean(v));

    if (resultIds.length) {
      await this.results.destroy({
        where: { tenant_uid: context.tenantUid, id: { [Op.in]: resultIds } },
      });
    }
    if (runIds.length) {
      await this.reviews.destroy({
        where: { tenant_uid: context.tenantUid, run_id: { [Op.in]: runIds } },
      });
      await this.runs.destroy({
        where: { tenant_uid: context.tenantUid, id: { [Op.in]: runIds } },
      });
    }
    if (transcriptIds.length) {
      await this.segments.destroy({
        where: { tenant_uid: context.tenantUid, transcript_id: { [Op.in]: transcriptIds } },
      });
      await this.transcripts.destroy({
        where: { tenant_uid: context.tenantUid, id: { [Op.in]: transcriptIds } },
      });
    }
    await this.relations.destroy({
      where: { tenant_uid: context.tenantUid, recording_id: id },
    });

    if (typeof (recording as { destroy?: () => Promise<unknown> }).destroy === 'function') {
      await (recording as { destroy: () => Promise<unknown> }).destroy();
    } else {
      await this.recordings.destroy({ where: { tenant_uid: context.tenantUid, id } });
    }

    // D-13: no refund - never touch wallet / settleShadow.
    void this.wallet;
    return { deleted: true as const, refunded: false as const };
  }

  /** One request for the journal selection so bulk delete does not trip the global rate limit. */
  async deleteMany(context: TenantContext, ids: string[]) {
    const unique = [...new Set(ids)];
    let deleted = 0;
    for (const id of unique) {
      try {
        await this.delete(context, id);
        deleted += 1;
      } catch (error) {
        if (error instanceof NotFoundException) continue;
        throw error;
      }
    }
    return { deleted };
  }

  /**
   * Access-scoped Excel export for the whole journal or an explicit UI selection.
   * Reuses the same CDR visibility rules as list/get (T-18-11-IDOR).
   */
  async exportExcel(
    context: TenantContext,
    selectedIds?: string[],
    presentation?: { locale?: string; timeZone?: string; headers?: JournalExcelHeaderLabels },
  ): Promise<Buffer> {
    const viewer = await this.resolveViewer(context);
    const scope = await this.resolveCdrScope(viewer);
    const requestedIds = selectedIds == null ? null : [...new Set(selectedIds)];
    if (requestedIds?.length === 0) return buildJournalExcel([], [], presentation);
    const recordings = await this.recordings.findAll({
      where: {
        tenant_uid: context.tenantUid,
        ...(requestedIds ? { id: { [Op.in]: requestedIds } } : {}),
      },
      order: [['occurred_at', 'DESC']],
    });
    const relations = await this.relations.findAll({
      where: {
        tenant_uid: context.tenantUid,
        recording_id: { [Op.in]: recordings.map((r) => r.id) },
      },
    });
    const sourceByRecording = new Map(
      relations.map((rel) => [rel.recording_id, rel.source_kind]),
    );

    const candidates: Array<JournalExcelRow & JournalRowAccessFields> = [];
    for (const recording of recordings) {
      const sourceKind = sourceByRecording.get(recording.id) ?? 'upload';
      const access = accessFieldsFromRecording(recording, sourceKind);
      candidates.push({
        ...access,
        occurredAt: recording.occurred_at?.toISOString?.() ?? String(recording.occurred_at),
        sourceKind,
        latestAmount: null,
        currency: null,
        summary: null,
        transcript: null,
        sttQuality: null,
        topics: null,
        rationales: null,
        scales: {},
      });
    }

    const visible = filterExportRowsByAccess(candidates, scope, viewer);
    if (visible.length === 0) {
      return buildJournalExcel([], [], presentation);
    }

    const runRows = await this.runs.findAll({
      where: {
        tenant_uid: context.tenantUid,
        recording_id: { [Op.in]: visible.map((r) => r.id) },
      },
      order: [['created_at', 'DESC']],
    });
    const latestByRecording = new Map<string, SaAnalysisRun>();
    const sortedRuns = [...runRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    for (const run of sortedRuns) {
      if (!latestByRecording.has(run.recording_id)) {
        latestByRecording.set(run.recording_id, run);
      }
    }

    const resultIds = [...latestByRecording.values()]
      .map((r) => r.result_id)
      .filter((id): id is string => Boolean(id));
    const resultRows = resultIds.length === 0
      ? []
      : await this.results.findAll({
        where: { tenant_uid: context.tenantUid, id: { [Op.in]: resultIds } },
      });
    const resultById = new Map(resultRows.map((r) => [r.id, r]));

    const transcriptIds = [...latestByRecording.values()]
      .map((r) => r.transcript_id)
      .filter((id): id is string => Boolean(id));
    const segmentRows = transcriptIds.length === 0
      ? []
      : await this.segments.findAll({
        where: {
          tenant_uid: context.tenantUid,
          transcript_id: { [Op.in]: transcriptIds },
        },
        order: [['ordinal', 'ASC']],
      });
    const textByTranscript = new Map<string, string>();
    for (const seg of segmentRows) {
      const prev = textByTranscript.get(seg.transcript_id) ?? '';
      textByTranscript.set(
        seg.transcript_id,
        prev ? `${prev}\n${seg.text}` : seg.text,
      );
    }

    const exportProjectIds = [...new Set(recordings.map((row) => row.project_id).filter((id): id is string => Boolean(id)))];
    const exportProjects = exportProjectIds.length === 0
      ? []
      : await this.projects.findAll({
        where: { tenant_uid: context.tenantUid, id: { [Op.in]: exportProjectIds } },
        attributes: ['id', 'draft_config'],
      });
    const exportTagNames = new Map(exportProjects.map((project) => [project.id, taxonomyNames(project.draft_config)]));
    const tagNamesByRecording = new Map(recordings.map((row) => [row.id, exportTagNames.get(row.project_id)]));

    const scaleKeySet = new Set<string>();
    const enriched: JournalExcelRow[] = visible.map((row) => {
      const latest = latestByRecording.get(row.id);
      const result = latest?.result_id ? resultById.get(latest.result_id) : undefined;
      const parsed = parseMetricResults(result?.metric_results, tagNamesByRecording.get(row.id));
      for (const key of Object.keys(parsed.scales)) scaleKeySet.add(key);
      return {
        id: row.id,
        occurredAt: row.occurredAt,
        sourceKind: row.sourceKind,
        latestAmount: latest?.amount ?? null,
        currency: latest?.currency ?? null,
        summary: result?.summary ?? null,
        transcript: latest?.transcript_id
          ? (textByTranscript.get(latest.transcript_id) ?? null)
          : null,
        sttQuality: result?.quality ?? null,
        topics: parsed.topics,
        rationales: parsed.rationales,
        scales: parsed.scales,
      };
    });

    return buildJournalExcel(enriched, [...scaleKeySet].sort(), presentation);
  }
}

function parseMetricResults(raw: unknown, names?: ReadonlyMap<string, string>): {
  topics: string | null;
  rationales: string | null;
  scales: Record<string, string | number | null>;
} {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  if (!Array.isArray(parsed)) {
    return { topics: null, rationales: null, scales: {} };
  }

  const topics: string[] = [];
  const rationales: string[] = [];
  const scales: Record<string, string | number | null> = {};
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const row = item as {
      id?: unknown;
      value?: unknown;
      rationale?: unknown;
    };
    const id = row.id != null ? String(row.id) : '';
    if (!id) continue;
    if (id === 'topic' || id === 'topics') {
      const rawTopics = Array.isArray(row.value) ? row.value : row.value == null ? [] : [row.value];
      for (const item of rawTopics) {
        if (typeof item !== 'string' && typeof item !== 'number') continue;
        const label = String(item).trim();
        if (label) topics.push(names?.get(label) ?? label);
      }
    } else if (typeof row.value === 'number' || typeof row.value === 'string' || row.value === null) {
      scales[id] = row.value as string | number | null;
    } else if (row.value != null) {
      scales[id] = String(row.value);
    }
    if (row.rationale != null && String(row.rationale).trim()) {
      rationales.push(`${id}: ${String(row.rationale)}`);
    }
  }
  return {
    topics: topics.length ? topics.join('; ') : null,
    rationales: rationales.length ? rationales.join('; ') : null,
    scales,
  };
}
