import {
  Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Put, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { TenantContextGuard, type TenantContextRequest } from '../integration-credentials/tenant-context.guard';
import { SpeechAnalyticsService, assertUuid } from './speech-analytics.service';
import { SaMetricsService } from './metrics/metrics.service';
import { SaReportingService } from './reporting/reporting.service';
import { SaJournalService } from './journal/journal.service';
import type { AnalyticsFilterSpec } from '@krasterisk/shared';
import type { SaProjectConfigV1 } from '@krasterisk/shared';
import type { MetricRubric } from './metrics/metric-engine';

type Authed = TenantContextRequest & { tenantContext: NonNullable<TenantContextRequest['tenantContext']> };

@UseGuards(TenantContextGuard)
@Controller('speech-analytics')
export class SpeechAnalyticsJwtController {
  constructor(
    private readonly analytics: SpeechAnalyticsService,
    private readonly metrics: SaMetricsService,
    private readonly reporting: SaReportingService,
    private readonly journal: SaJournalService,
  ) {}

  @Get('journal')
  listJournal(@Req() request: Authed) {
    return this.journal.list(request.tenantContext);
  }

  /** Entire filtered selection Excel (D-37). Must be registered before journal/:id. */
  @Get('journal/export')
  async exportJournalExcel(@Req() request: Authed, @Res() res: Response) {
    const buffer = await this.journal.exportExcel(request.tenantContext);
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

  @Post('journal/:id/regenerate')
  @HttpCode(202)
  regenerateJournal(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.journal.regenerate(request.tenantContext, id);
  }

  @Delete('journal/:id')
  deleteJournal(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.journal.delete(request.tenantContext, id);
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

  @Post('projects/:id/publish')
  publish(@Req() request: Authed, @Param('id') id: string, @Body() body: { operationKey: string }) {
    assertUuid(id);
    return this.analytics.publish(request.tenantContext, id, body.operationKey);
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
