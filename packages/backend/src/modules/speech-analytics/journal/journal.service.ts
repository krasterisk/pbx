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
  /** Test-only seam — production never wires a wallet (D-13 no refund). */
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

    const resultIds = [...latestByRecording.values()]
      .map((r) => r.result_id)
      .filter((id): id is string => Boolean(id));
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
        attributes: ['id', 'name'],
      });
    const projectNameById = new Map(projectRows.map((project) => [project.id, project.name]));

    const items = visible.map((row) => {
      const sourceKind = sourceByRecording.get(row.id) ?? 'upload';
      const latest = latestByRecording.get(row.id);
      const result = latest?.result_id ? resultById.get(latest.result_id) : undefined;
      const columns = readJournalColumns({
        metadata: row.metadata,
        audioMs: latest?.audio_ms ?? null,
        metricResults: result?.metric_results ?? null,
        quality: result?.quality ?? null,
        projectName: projectNameById.get(row.project_id) ?? null,
      });
      return {
        id: row.id,
        occurredAt: row.occurred_at?.toISOString?.() ?? String(row.occurred_at),
        sourceKind,
        latestAmount: latest?.amount ?? null,
        currency: latest?.currency ?? null,
        summary: result?.summary ?? null,
        ...columns,
      };
    });

    return {
      items,
      total: items.length,
      uploadProgress: { done: 0, total: 0 },
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

    return {
      id: recording.id,
      sourceKind,
      audioUrl: null as string | null,
      summary: result[0]?.summary ?? null,
      transcriptText: null as string | null,
      rebuildInProgress,
      runs: orderedRuns.map((run) => ({
        id: run.id,
        amount: run.amount,
        currency: run.currency,
        createdAt: run.created_at?.toISOString?.() ?? String(run.created_at),
      })),
    };
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

    // D-13: no refund — never touch wallet / settleShadow.
    void this.wallet;
    return { deleted: true as const, refunded: false as const };
  }

  /**
   * Access-scoped Excel export of the entire filtered journal selection (D-37).
   * Reuses the same CDR visibility rules as list/get (T-18-11-IDOR).
   */
  async exportExcel(context: TenantContext): Promise<Buffer> {
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
      return buildJournalExcel([], []);
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

    const scaleKeySet = new Set<string>();
    const enriched: JournalExcelRow[] = visible.map((row) => {
      const latest = latestByRecording.get(row.id);
      const result = latest?.result_id ? resultById.get(latest.result_id) : undefined;
      const parsed = parseMetricResults(result?.metric_results);
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

    return buildJournalExcel(enriched, [...scaleKeySet].sort());
  }
}

function parseMetricResults(raw: unknown): {
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
      if (row.value != null) topics.push(String(row.value));
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
