import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  defaultSaProjectConfig,
  digestSchedules,
  projectNotices,
  type SaNotice,
  type SaProjectConfigV1,
} from '@krasterisk/shared';
import { UserLevel } from '../../users/user.model';
import { NotificationIntegration } from '../../notifications/notification-integration.model';
import { NotificationDispatcherService } from '../../notifications/notification-dispatcher.service';
import { aggregateDashboard } from '../dashboard/dashboard.service';
import { readJournalColumns } from '../journal/journal-row-view';
import { SaAnalysisRun, SaProject, SaRecording, SaResult } from '../speech-analytics.models';
import { dueDigestSchedules } from '../ops/speech-analytics-ops';
import { alertDetail, noticeWindow } from './notice-eval';
import {
  alertDocument,
  digestDocument,
  renderNoticeHtml,
  renderNoticeText,
  type NoticeFacts,
} from './notice-document';

@Injectable()
export class SaNoticeDeliveryService {
  private readonly logger = new Logger(SaNoticeDeliveryService.name);

  constructor(
    @InjectModel(SaProject) private readonly projects: typeof SaProject,
    @InjectModel(SaRecording) private readonly recordings: typeof SaRecording,
    @InjectModel(SaAnalysisRun) private readonly runs: typeof SaAnalysisRun,
    @InjectModel(SaResult) private readonly results: typeof SaResult,
    @InjectModel(NotificationIntegration) private readonly integrations: typeof NotificationIntegration,
    private readonly notifications: NotificationDispatcherService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async tick(): Promise<void> {
    await this.runDue(new Date());
  }

  async runDue(now: Date): Promise<void> {
    const projects = await this.projects.findAll({ where: { status: 'active' } });
    for (const project of projects) {
      try {
        await this.runProject(project, now);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`speech analytics notices failed project=${project.id}: ${message}`);
      }
    }
  }

  async sendTest(tenantUid: number, projectId: string, noticeId: string) {
    const project = await this.projects.findOne({ where: { tenant_uid: tenantUid, id: projectId } });
    if (!project) throw new NotFoundException({ code: 'resource_not_found' });
    const config = this.parse(project.draft_config);
    const notice = projectNotices(config).find((row) => row.id === noticeId);
    if (!notice) throw new NotFoundException({ code: 'resource_not_found' });
    const facts = await this.facts(project, notice, new Date());
    const doc = notice.kind === 'digest'
      ? digestDocument(notice, facts)
      : alertDocument(notice, facts, 'Проверка уведомления.');
    const recipients = await this.deliver(project.tenant_uid, config.digest.integrationUids ?? [], doc);
    return { sent: true, recipients };
  }

  private async runProject(project: SaProject, now: Date): Promise<void> {
    const config = this.parse(project.draft_config);
    const uids = config.digest.integrationUids ?? [];
    if (!uids.length) return;
    const notices = projectNotices(config);
    const dueIds = dueDigestSchedules(config.digest, now).map((slot) => slot.id);
    const digestNotices = notices.filter((row) => row.enabled && row.kind === 'digest');
    const fired: string[] = [];
    if (dueIds.length && digestNotices.length) {
      for (const notice of digestNotices) {
        const facts = await this.facts(project, notice, now);
        await this.deliver(project.tenant_uid, uids, digestDocument(notice, facts));
      }
    }
    for (const notice of notices.filter((row) => row.enabled && row.kind !== 'digest')) {
      const detail = await this.criticalDetail(project, notice, config, now);
      if (!detail) continue;
      const facts = await this.facts(project, notice, now);
      await this.deliver(project.tenant_uid, uids, alertDocument(notice, facts, detail));
      fired.push(notice.id);
    }
    const sentScheduleIds = digestNotices.length ? dueIds : [];
    if (!sentScheduleIds.length && !fired.length) return;
    await this.stamp(project, config, sentScheduleIds, fired, now);
  }

  private async criticalDetail(
    project: SaProject,
    notice: SaNotice,
    config: SaProjectConfigV1,
    now: Date,
  ): Promise<string | null> {
    const days = Math.max(1, notice.windowDays ?? 7);
    const recentFrom = new Date(now.getTime() - days * 86400000);
    const previousFrom = new Date(recentFrom.getTime() - days * 86400000);
    const recent = aggregateDashboard({
      conversations: await this.conversations(project, recentFrom, now),
      scope: null,
      viewer: { userId: 0, level: UserLevel.SUPERADMIN },
    });
    const previous = aggregateDashboard({
      conversations: await this.conversations(project, previousFrom, recentFrom),
      scope: null,
      viewer: { userId: 0, level: UserLevel.SUPERADMIN },
    });
    const spent = notice.kind === 'budget'
      ? await this.monthSpend(project, now)
      : 0;
    return alertDetail(notice, recent, previous, spent, notice.softLimit ?? config.budget?.softLimit ?? 0, now);
  }

  private async facts(project: SaProject, notice: SaNotice, now: Date): Promise<NoticeFacts> {
    const window = noticeWindow(notice.reportWindow, now);
    const conversations = await this.conversations(project, window.from, window.to);
    const aggregate = aggregateDashboard({
      conversations,
      scope: null,
      viewer: { userId: 0, level: UserLevel.SUPERADMIN },
    });
    const topics = new Map<string, number>();
    for (const row of conversations) {
      for (const topic of row.topicLabels ?? []) {
        topics.set(topic, (topics.get(topic) ?? 0) + 1);
      }
    }
    const csatValues = conversations
      .map((row) => row.overallScore)
      .filter((value): value is number => value != null);
    const csat = csatValues.length
      ? csatValues.reduce((sum, value) => sum + value, 0) / csatValues.length
      : null;
    return {
      projectName: project.name,
      periodLabel: window.label,
      conversationCount: aggregate.conversationCount,
      averageScore: aggregate.averageScore,
      csat,
      sentiment: aggregate.sentiment,
      successRate: aggregate.successRate,
      costTotal: aggregate.costTotal,
      currency: aggregate.currency,
      metrics: aggregate.customMetrics.map((metric) => ({ label: metric.label, avg: metric.avg })),
      topics: [...topics.entries()].map(([label, count]) => ({ label, count })),
      lowSttCount: aggregate.lowSttCount,
      lowSttPct: aggregate.conversationCount
        ? (aggregate.lowSttCount / aggregate.conversationCount) * 100
        : null,
    };
  }

  private async conversations(project: SaProject, from: Date, to: Date) {
    const recordings = await this.recordings.findAll({
      where: {
        tenant_uid: project.tenant_uid,
        project_id: project.id,
        occurred_at: { [Op.gte]: from, [Op.lt]: to },
      },
    });
    if (!recordings.length) return [];
    const ids = recordings.map((row) => row.id);
    const runs = await this.runs.findAll({
      where: { tenant_uid: project.tenant_uid, recording_id: { [Op.in]: ids } },
      order: [['created_at', 'DESC']],
    });
    const latest = new Map<string, SaAnalysisRun>();
    for (const run of runs) {
      if (!latest.has(run.recording_id)) latest.set(run.recording_id, run);
    }
    const resultIds = [...latest.values()].map((run) => run.result_id).filter((id): id is string => Boolean(id));
    const results = resultIds.length
      ? await this.results.findAll({ where: { tenant_uid: project.tenant_uid, id: { [Op.in]: resultIds } } })
      : [];
    const resultById = new Map(results.map((row) => [row.id, row]));
    return recordings.map((row) => {
      const run = latest.get(row.id);
      const result = run?.result_id ? resultById.get(run.result_id) : undefined;
      const columns = readJournalColumns({
        metadata: row.metadata,
        audioMs: run?.audio_ms ?? null,
        metricResults: result?.metric_results ?? null,
        quality: result?.quality ?? null,
        projectName: project.name,
      });
      const scores: Record<string, number> = {};
      const raw = result?.metric_results;
      const parsed = typeof raw === 'string' ? safeJson(raw) : raw;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue;
          const id = String((item as { id?: unknown }).id ?? '');
          const value = (item as { value?: unknown }).value;
          if (!id || id.startsWith('_') || ['csat', 'customer_sentiment', 'topics', 'success'].includes(id)) continue;
          if (typeof value === 'number' && Number.isFinite(value)) scores[id] = value;
        }
      }
      return {
        id: row.id,
        operatorExten: columns.operatorName,
        operatorName: columns.operatorName,
        uploadedByUserId: null,
        sourceKind: 'upload',
        latestAmount: run?.amount ?? null,
        currency: run?.currency ?? null,
        lowStt: columns.lowStt,
        success: columns.success,
        sentiment: columns.sentiment,
        scaleScores: {},
        customScores: scores,
        dayLabel: columns.operatorName ?? row.id,
        overallScore: columns.score,
        topicLabels: columns.topics,
      };
    });
  }

  private async monthSpend(project: SaProject, now: Date): Promise<number> {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const rows = await this.conversations(project, from, now);
    return rows.reduce((sum, row) => sum + (Number(row.latestAmount) || 0), 0);
  }

  private async deliver(
    tenantUid: number,
    uids: number[],
    doc: ReturnType<typeof digestDocument>,
  ): Promise<number> {
    if (!uids.length) throw new UnprocessableEntityException({ code: 'digest_recipient_required' });
    const owned = await this.integrations.findAll({
      where: { uid: { [Op.in]: uids }, user_uid: tenantUid },
    });
    if (!owned.length) throw new UnprocessableEntityException({ code: 'digest_recipient_required' });
    const message = renderNoticeText(doc);
    const html = renderNoticeHtml(doc);
    let sent = 0;
    for (const row of owned) {
      const result = await this.notifications.dispatch({
        integration_uid: row.uid,
        subject: doc.title,
        message,
        attach: {
          filename: 'summary.html',
          content: html,
          contentType: 'text/html',
        },
      });
      if (!result?.success) {
        throw new UnprocessableEntityException({ code: result?.error || 'notify_failed' });
      }
      sent += 1;
    }
    return sent;
  }

  private async stamp(
    project: SaProject,
    config: SaProjectConfigV1,
    scheduleIds: string[],
    noticeIds: string[],
    now: Date,
  ): Promise<void> {
    const iso = now.toISOString();
    const schedules = digestSchedules(config.digest).map((slot) => (
      scheduleIds.includes(slot.id) ? { ...slot, lastSentAt: iso } : slot
    ));
    const notices = projectNotices(config).map((notice) => (
      noticeIds.includes(notice.id) ? { ...notice, lastFiredAt: iso } : notice
    ));
    const next: SaProjectConfigV1 = {
      ...config,
      notices,
      digest: {
        ...config.digest,
        enabled: schedules.length > 0,
        schedules,
        lastSentAt: scheduleIds.length ? iso : config.digest.lastSentAt,
      },
    };
    project.draft_config = JSON.stringify(next);
    project.draft_revision += 1;
    project.updated_at = now;
    await project.save();
  }

  private parse(raw: string): SaProjectConfigV1 {
    try {
      return { ...defaultSaProjectConfig(), ...(JSON.parse(raw) as SaProjectConfigV1) };
    } catch {
      return defaultSaProjectConfig();
    }
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
