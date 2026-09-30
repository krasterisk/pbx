import {
  Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, HttpException, Param, Post, Put, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { TenantContextGuard, type TenantContextRequest } from '../integration-credentials/tenant-context.guard';
import { ProductAccessService } from '../product-access/product-access.service';
import { SpeechAnalyticsService, assertUuid } from './speech-analytics.service';
import { SaMetricsService } from './metrics/metrics.service';
import { SaReportingService } from './reporting/reporting.service';
import { SaJournalService } from './journal/journal.service';
import type { JournalExcelHeaderLabels } from './journal/excel-export';
import { InsightsService } from './dashboard/insights.service';
import { SaNoticeDeliveryService } from './notices/notice-delivery.service';
import type { AnalyticsFilterSpec } from '@krasterisk/shared';
import type { SaProjectConfigV1 } from '@krasterisk/shared';
import type { MetricRubric } from './metrics/metric-engine';
import {
  assertGetAnalyticsAllowed,
  resolveGetAnalyticsProject,
} from './ingest/url-download';

type Authed = TenantContextRequest & { tenantContext: NonNullable<TenantContextRequest['tenantContext']> };

const JOURNAL_EXCEL_HEADER_KEYS = [
  'occurredAt', 'sourceKind', 'latestAmount', 'currency', 'summary',
  'transcript', 'sttQuality', 'topics', 'rationales',
] as const;

function journalExportLocale(bodyLocale: unknown, request: Authed): string {
  if (typeof bodyLocale === 'string' && bodyLocale.trim()) return bodyLocale.trim();
  const header = request.headers?.['accept-language'];
  if (typeof header === 'string' && header.trim()) return header.split(',')[0]?.trim() || 'ru';
  return 'ru';
}

function journalExportHeaders(raw: unknown): JournalExcelHeaderLabels | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const out: JournalExcelHeaderLabels = {};
  for (const key of JOURNAL_EXCEL_HEADER_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

@UseGuards(TenantContextGuard)
@Controller('speech-analytics')
export class SpeechAnalyticsJwtController {
  constructor(
    private readonly analytics: SpeechAnalyticsService,
    private readonly metrics: SaMetricsService,
    private readonly reporting: SaReportingService,
    private readonly journal: SaJournalService,
    private readonly insights: InsightsService,
    private readonly notices: SaNoticeDeliveryService,
    private readonly products: ProductAccessService,
  ) {}

  @Get('journal')
  listJournal(@Req() request: Authed) {
    return this.journal.list(request.tenantContext);
  }

  @Post('analysis-jobs/:id/dismiss')
  @HttpCode(200)
  dismissAnalysisJob(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.journal.dismissAnalysisJob(request.tenantContext, id);
  }

  /** Entire access-scoped journal Excel (D-37). Must be registered before journal/:id. */
  @Get('journal/export')
  async exportJournalExcel(@Req() request: Authed, @Res() res: Response) {
    return this.sendJournalExcel(res, await this.journal.exportExcel(
      request.tenantContext,
      undefined,
      { locale: journalExportLocale(undefined, request) },
    ));
  }

  /**
   * Export only the conversations selected in the journal UI. The service
   * intersects these IDs with the current tenant and the caller's CDR scope.
   */
  @Post('journal/export')
  async exportSelectedJournalExcel(
    @Req() request: Authed,
    @Body() body: { ids?: unknown; locale?: unknown; timeZone?: unknown; headers?: unknown } = {},
    @Res() res: Response,
  ) {
    const selectedIds = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string')
      : [];
    return this.sendJournalExcel(
      res,
      await this.journal.exportExcel(request.tenantContext, selectedIds, {
        locale: journalExportLocale(body.locale, request),
        timeZone: typeof body.timeZone === 'string' ? body.timeZone : undefined,
        headers: journalExportHeaders(body.headers),
      }),
    );
  }

  private sendJournalExcel(res: Response, buffer: Buffer) {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="speech-analytics-journal.xlsx"',
    );
    return res.send(buffer);
  }

  @Get('journal/:id')
  getJournal(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.journal.get(request.tenantContext, id);
  }

  @Post('journal/:id/overrides')
  saveJournalOverride(@Req() request: Authed, @Param('id') id: string, @Body() body: {
    metricId?: string;
    value?: string;
    note?: string;
  }) {
    assertUuid(id);
    return this.journal.saveOverride(request.tenantContext, id, {
      metricId: String(body.metricId ?? ''),
      value: String(body.value ?? ''),
      note: body.note,
    });
  }

  @Post('journal/:id/regenerate')
  @HttpCode(202)
  regenerateJournal(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.journal.regenerate(request.tenantContext, id);
  }

  @Post('journal/delete')
  @HttpCode(200)
  deleteJournalMany(@Req() request: Authed, @Body() body: { ids?: unknown } = {}) {
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string')
      : [];
    for (const id of ids) assertUuid(id);
    return this.journal.deleteMany(request.tenantContext, ids);
  }

  @Delete('journal/:id')
  deleteJournal(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.journal.delete(request.tenantContext, id);
  }

  /**
   * CDR / manual Get analytics (D-18, D-19, D-22).
   * Same recording asset (no second copy). Project from route, else client must supply.
   * Pause does not block; module off does.
   */
  @Post('get-analytics')
  @HttpCode(202)
  async getAnalytics(
    @Req() request: Authed,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: {
      assetId: string;
      routeProjectId?: string | null;
      projectId?: string | null;
      hasRecording?: boolean;
      externalCallId?: string;
      pauseNew?: boolean;
    },
  ) {
    assertUuid(body.assetId);
    const access = await this.products.decide(request.tenantContext.tenantUid, 'speech_analytics');
    assertGetAnalyticsAllowed({
      moduleActive: access.allowed === true,
      hasRecording: body.hasRecording !== false,
      pauseNew: body.pauseNew === true,
    });
    const projectId = resolveGetAnalyticsProject(body.routeProjectId, body.projectId);
    assertUuid(projectId);
    if (!idempotencyKey) {
      throw new ForbiddenException({ code: 'idempotency_key_required' });
    }
    // Same assetId - never allocate a second copy (D-18).
    return this.analytics.createRun(request.tenantContext, {
      projectId,
      assetId: body.assetId,
      externalCallId: body.externalCallId,
      idempotencyKey,
      metadata: { source: 'get_analytics' },
    });
  }

  @Get('projects')
  list(@Req() request: Authed) {
    return this.analytics.listProjects(request.tenantContext);
  }

  @Post('projects')
  @HttpCode(201)
  create(@Req() request: Authed, @Body() body: { name: string }) {
    return this.analytics.createProject(request.tenantContext, body.name);
  }

  @Put('projects/:id/draft')
  draft(@Req() request: Authed, @Param('id') id: string, @Headers('if-match') match: string,
    @Body() body: SaProjectConfigV1) {
    assertUuid(id);
    return this.analytics.updateDraft(request.tenantContext, id, Number(match), body);
  }

  @Put('projects/:id/intake')
  intake(@Req() request: Authed, @Param('id') id: string, @Body() body: { enabled: boolean }) {
    assertUuid(id);
    return this.analytics.setIntake(request.tenantContext, id, body.enabled === true);
  }

  @Get('projects/:id/versions')
  listVersions(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.listVersions(request.tenantContext, id);
  }

  @Post('projects/:id/versions/:versionId/restore')
  restoreVersion(@Req() request: Authed, @Param('id') id: string, @Param('versionId') versionId: string) {
    assertUuid(id);
    assertUuid(versionId);
    return this.analytics.restoreVersion(request.tenantContext, id, versionId);
  }

  @Post('projects/:id/publish')
  publish(@Req() request: Authed, @Param('id') id: string, @Body() body: { operationKey: string }) {
    assertUuid(id);
    return this.analytics.publish(request.tenantContext, id, body.operationKey);
  }

  @Delete('projects/:id/permanent')
  purgeProject(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.purgeProject(request.tenantContext, id);
  }

  @Delete('projects/:id')
  deleteProject(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.deleteProject(request.tenantContext, id);
  }

  @Post('projects/:id/digest/send')
  @HttpCode(200)
  sendDigest(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.sendProjectDigest(request.tenantContext, id);
  }

  @Post('projects/:id/notices/:noticeId/test')
  @HttpCode(200)
  testNotice(@Req() request: Authed, @Param('id') id: string, @Param('noticeId') noticeId: string) {
    assertUuid(id);
    return this.notices.sendTest(request.tenantContext.tenantUid, id, noticeId);
  }

  @Post('projects/:id/alerts/test')
  @HttpCode(200)
  testAlert(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.testProjectAlert(request.tenantContext, id);
  }

  @Post('projects/:id/webhook/test')
  @HttpCode(200)
  testWebhook(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.testProjectWebhook(request.tenantContext, id);
  }

  @Post('projects/:id/budget/evaluate')
  evaluateBudget(
    @Req() request: Authed,
    @Param('id') id: string,
    @Body() body: { from?: string; to?: string },
  ) {
    assertUuid(id);
    return this.analytics.evaluateProjectBudget(request.tenantContext, id, {
      from: body.from,
      to: body.to,
    });
  }

  @Get('recordings')
  recordings(@Req() request: Authed, @Query('projectId') projectId: string, @Query('cursor') cursor?: string) {
    assertUuid(projectId);
    return this.analytics.listRecordings(request.tenantContext, projectId, cursor);
  }

  @Get('capabilities')
  capabilities() {
    return this.analytics.capabilities();
  }

  @Get('speech-models')
  speechModels(@Req() request: Authed) {
    return this.analytics.cabinetSpeechModels(request.tenantContext.tenantUid);
  }

  @Put('speech-models')
  saveSpeechModels(@Req() request: Authed, @Body() body: {
    sttProviderUid?: number | null;
    llmProviderUid?: number | null;
    projectOverride?: boolean;
  }) {
    return this.analytics.saveCabinetSpeechModels(request.tenantContext.tenantUid, body ?? {});
  }

  @Post('uploads')
  @HttpCode(201)
  upload(@Req() request: Authed, @Body() body: { projectId: string; expectedBytes?: number }) {
    assertUuid(body.projectId);
    return this.analytics.allocateUpload(request.tenantContext, body.projectId, body.expectedBytes);
  }

  @Put('uploads/:id/content')
  content(@Req() request: Authed, @Param('id') id: string, @Body() body: { bytesBase64: string }) {
    assertUuid(id);
    return this.analytics.putUploadContent(request.tenantContext, id, Buffer.from(body.bytesBase64, 'base64'));
  }

  @Post('uploads/:id/complete')
  complete(@Req() request: Authed, @Param('id') id: string, @Body() body: { checksum?: string }) {
    assertUuid(id);
    return this.analytics.completeUpload(request.tenantContext, id, body.checksum);
  }

  @Post('analysis-runs')
  @HttpCode(202)
  run(@Req() request: Authed, @Headers('idempotency-key') idempotencyKey: string, @Body() body: {
    projectId: string; assetId: string; externalCallId?: string; sourcePart?: string;
    metadata?: Record<string, unknown>;
    configSource?: 'draft' | 'published';
  }) {
    assertUuid(body.projectId);
    assertUuid(body.assetId);
    return this.analytics.createRun(request.tenantContext, { ...body, idempotencyKey });
  }

  @Get('analysis-runs/:id')
  getRun(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.getRun(request.tenantContext, id, 'analytics:read');
  }

  @Get('analysis-runs/:id/result')
  result(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.getRun(request.tenantContext, id, 'analytics:read');
  }

  @Get('analysis-runs/:id/transcript')
  transcript(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.getRun(request.tenantContext, id, 'analytics:transcript');
  }

  @Post('analysis-runs/:id/cancel')
  cancel(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.cancelRun(request.tenantContext, id);
  }

  @Get('projects/:id/metrics')
  metricsList(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.metrics.list(request.tenantContext, id);
  }

  @Post('projects/:id/metrics')
  publishMetric(@Req() request: Authed, @Param('id') id: string, @Body() body: {
    operationKey: string; rubric: MetricRubric;
  }) {
    assertUuid(id);
    return this.metrics.publish(request.tenantContext, id, body.operationKey, body.rubric);
  }

  @Post('analysis-runs/:id/reanalyses')
  reanalyze(@Req() request: Authed, @Headers('idempotency-key') idempotencyKey: string, @Param('id') id: string,
    @Body() body: { projectVersionId: string; reason: string }) {
    assertUuid(id);
    assertUuid(body.projectVersionId);
    return this.metrics.reanalyze(request.tenantContext, id, {
      projectVersionId: body.projectVersionId, reason: body.reason, idempotencyKey,
    });
  }

  @Post('analysis-runs/:id/reviews')
  review(@Req() request: Authed, @Param('id') id: string, @Body() body: {
    metricRevisionId: string; value: string; status: 'accepted' | 'rejected' | 'cancelled';
    reason: string; commandKey: string; expectedRevision: number;
  }) {
    assertUuid(id);
    return this.metrics.review(request.tenantContext, id, body);
  }

  @Post('transcripts/:id/corrections')
  correct(@Req() request: Authed, @Param('id') id: string, @Body() body: { text: string; reason: string }) {
    assertUuid(id);
    return this.metrics.correctTranscript(request.tenantContext, id, body);
  }

  @Post('dashboard')
  dashboard(@Req() request: Authed, @Body() body: AnalyticsFilterSpec) {
    return this.reporting.dashboard(request.tenantContext, body);
  }

  @Post('dashboard/drill')
  @HttpCode(200)
  dashboardDrill(@Req() request: Authed, @Body() body: AnalyticsFilterSpec & {
    drill?: {
      type?: string;
      sentiment?: string;
      success?: string | boolean;
      day?: string;
      topic?: string;
      operatorName?: string | null;
      metricId?: string;
      insightType?: string;
      recordingIds?: string[];
    };
  }) {
    const drill = body.drill ?? { type: 'all' };
    const type = drill.type;
    if (
      type !== 'all' && type !== 'lowStt' && type !== 'cost' && type !== 'success'
      && type !== 'sentiment' && type !== 'day' && type !== 'topic'
      && type !== 'operator' && type !== 'metric' && type !== 'exemplars' && type !== 'recordings'
    ) {
      throw new HttpException({ code: 'filter_invalid' }, 400);
    }
    return this.reporting.dashboardDrill(request.tenantContext, body, { ...drill, type });
  }

  @Post('insights')
  requestInsights(
    @Req() request: Authed,
    @Body() body: {
      projectId: string;
      from?: string;
      to?: string;
      refresh?: boolean;
    },
  ) {
    assertUuid(body.projectId);
    return this.insights.requestForTenant(request.tenantContext, body);
  }

  @Post('exports')
  exportCsv(@Req() request: Authed, @Body() body: { filter: AnalyticsFilterSpec; rows: string[][] }) {
    return this.reporting.exportCsv(request.tenantContext, body.filter, body.rows);
  }

  @Get('capture-policy')
  policy(@Req() request: Authed) {
    return this.reporting.getPolicy(request.tenantContext);
  }

  @Put('capture-policy')
  setPolicy(@Req() request: Authed, @Body() body: {
    defaultEnabled?: boolean; defaultProjectId?: string | null; pauseNew?: boolean;
  }) {
    return this.reporting.setPolicy(request.tenantContext, body);
  }

  @Post('capture-policy/resolve')
  resolve(@Req() request: Authed, @Body() body: {
    mode?: unknown; projectId?: string | null; recordingEnabled: boolean;
  }) {
    return this.reporting.resolveRoute(request.tenantContext, body);
  }

  @Post('budgets/:projectId')
  budget(@Req() request: Authed, @Param('projectId') projectId: string, @Body() body: {
    unitCap: number; pauseOnExceed: boolean;
  }) {
    assertUuid(projectId);
    return this.reporting.setBudget(request.tenantContext, projectId, body.unitCap, body.pauseOnExceed);
  }

  @Post('bulk-reanalyses')
  bulk(@Req() request: Authed, @Body() body: { projectId: string; recordingIds: string[] }) {
    assertUuid(body.projectId);
    return this.reporting.startBulk(request.tenantContext, body.projectId, body.recordingIds);
  }

  @Get('recordings/:id/relations')
  relations(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.reporting.listRelations(request.tenantContext, id);
  }

  @Post('backfill-preview')
  backfill(@Req() request: Authed, @Body() body: { path?: string }) {
    return this.reporting.previewBackfill(request.tenantContext, body.path);
  }
}
