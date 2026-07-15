import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { CcAlertConfig } from './models/alert-config.model';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CallCenterSettingsService } from './callcenter-settings.service';
import { CallCenterStateService } from './callcenter-state.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';

/**
 * How often the threshold evaluator runs (ms).
 * Not AMI hot path — 30s is enough for supervisor alerts.
 */
export const ALERT_EVAL_INTERVAL_MS = 30_000;

type ThresholdKey = 'sla' | 'abandon' | 'agents' | 'wait';

interface Breach {
  key: ThresholdKey;
  message: string;
}

/**
 * Periodical evaluator: compare live metrics + state snapshot against
 * cc_settings.alert_thresholds (WHEN — D-27 from 07-05) and route via
 * cc_alert_config + notification_integration (WHERE — D-28).
 * Credential store is NOT duplicated — reuse Phase 6 notification_integration.
 */
@Injectable()
export class CallCenterAlertService {
  private readonly logger = new Logger(CallCenterAlertService.name);

  /** Cooldown state: `${userUid}:${thresholdKey}` → last fire timestamp */
  private readonly lastFired = new Map<string, number>();

  constructor(
    @InjectModel(CcAlertConfig)
    private readonly alertConfigModel: typeof CcAlertConfig,
    private readonly metricsService: CallCenterMetricsService,
    private readonly settingsService: CallCenterSettingsService,
    private readonly stateService: CallCenterStateService,
    private readonly dispatcherService: NotificationDispatcherService,
  ) {}

  @Interval('cc-alert-eval', ALERT_EVAL_INTERVAL_MS)
  async evaluate(): Promise<void> {
    try {
      const configs = await this.alertConfigModel.findAll({
        where: { enabled: true },
      });

      for (const row of configs) {
        await this.evaluateTenant(row);
      }
    } catch (e: any) {
      this.logger.error(`Alert evaluate failed: ${e?.message ?? e}`);
    }
  }

  private async evaluateTenant(row: CcAlertConfig): Promise<void> {
    const userUid = row.user_uid;
    if (row.integration_uid == null || !row.target) {
      return; // nowhere / nothing to send with
    }

    const settings = await this.settingsService.getTenantSettings(userUid);
    const thresholds = settings.alert_thresholds;
    if (!thresholds) {
      return;
    }

    const metrics = this.metricsService.getTenantQueueMetrics(userUid);
    const snapshot = this.stateService.getSnapshot(userUid);
    const breaches = this.detectBreaches(thresholds, metrics, snapshot);

    const now = Date.now();
    const cooldownMs = (row.cooldown_sec ?? 300) * 1000;

    for (const breach of breaches) {
      const mapKey = `${userUid}:${breach.key}`;
      const last = this.lastFired.get(mapKey) ?? 0;
      if (now - last < cooldownMs) {
        continue; // anti-flood (T-07-10-05)
      }
      this.lastFired.set(mapKey, now);
      await this.dispatcherService.dispatch({
        integration_uid: row.integration_uid,
        target: row.target,
        message: breach.message,
      });
    }
  }

  private detectBreaches(
    thresholds: Record<string, number>,
    metrics: Array<{
      queueName: string;
      sla: number;
      abandonRate: number;
    }>,
    snapshot: {
      queues: Array<{ agents: { available: number } }>;
      calls: Array<{ status: string; enterTime: Date }>;
    },
  ): Breach[] {
    const breaches: Breach[] = [];

    if (thresholds.sla_critical_pct != null) {
      for (const m of metrics) {
        if (m.sla < thresholds.sla_critical_pct) {
          breaches.push({
            key: 'sla',
            message: `КЦ: SLA очереди ${m.queueName} упал до ${Math.round(m.sla)}% (порог ${thresholds.sla_critical_pct}%)`,
          });
          break;
        }
      }
    }

    if (thresholds.abandon_rate_pct != null) {
      for (const m of metrics) {
        if (m.abandonRate > thresholds.abandon_rate_pct) {
          breaches.push({
            key: 'abandon',
            message: `КЦ: abandon rate очереди ${m.queueName} ${Math.round(m.abandonRate)}% (порог ${thresholds.abandon_rate_pct}%)`,
          });
          break;
        }
      }
    }

    if (thresholds.agents_available_min != null) {
      const available = snapshot.queues.reduce(
        (sum, q) => sum + (q.agents?.available ?? 0),
        0,
      );
      if (available < thresholds.agents_available_min) {
        breaches.push({
          key: 'agents',
          message: `КЦ: доступно агентов ${available} (порог min ${thresholds.agents_available_min})`,
        });
      }
    }

    if (thresholds.max_wait_sec != null) {
      const now = Date.now();
      let maxWaitSec = 0;
      for (const call of snapshot.calls) {
        if (call.status !== 'WAITING') continue;
        const enterMs = call.enterTime instanceof Date
          ? call.enterTime.getTime()
          : new Date(call.enterTime).getTime();
        const waitSec = Math.floor((now - enterMs) / 1000);
        if (waitSec > maxWaitSec) maxWaitSec = waitSec;
      }
      if (maxWaitSec > thresholds.max_wait_sec) {
        breaches.push({
          key: 'wait',
          message: `КЦ: макс. ожидание ${maxWaitSec}с (порог ${thresholds.max_wait_sec}с)`,
        });
      }
    }

    return breaches;
  }

  /** Test helper — clear cooldown state between specs. */
  clearCooldown(): void {
    this.lastFired.clear();
  }
}
