import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Route } from './route.model';
import axios from 'axios';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { WebhookQueueService } from './webhook-queue.service';
import { decideHangupAnalysisAdmission } from '../speech-analytics/reporting/internal-admission';

export const HANGUP_ANALYTICS_PORT = 'HANGUP_ANALYTICS_PORT';

export type HangupAnalyticsContext = {
  entitled: boolean;
  pauseNew: boolean;
  privacyDenied: boolean;
  recordingEnabled: boolean;
  projectActive: boolean;
  projectPublished: boolean;
  sameTenantProject: boolean;
  policyRevision: number;
  nodeId: string;
  knownOrigins: Set<string>;
};

export type HangupAnalysisJobInput = {
  tenantUid: number;
  routeUid: number;
  projectId: string;
  uniqueid: string;
  recordPath: string;
  durationSec: number;
  policyRevision: number;
  nodeId: string;
  originKey: string;
};

/** Optional port: resolve capture context + enqueue ai_jobs (D-03). No STT here. */
export type HangupAnalyticsPort = {
  resolveHangupContext(input: {
    tenantUid: number;
    routeUid: number;
    routeProjectId: string | null;
  }): Promise<HangupAnalyticsContext>;
  enqueueAnalysisJob(input: HangupAnalysisJobInput): Promise<{ jobId: string }>;
};

export interface WebhookPayload {
  event: string;
  route_uid: string;
  uniqueid: string;
  callerid: string;
  user_uid: string;
  [key: string]: any;
}

/**
 * Resolved webhook target — normalized from any storage format.
 * Frontend stores webhooks as:
 *   - plain string:  "https://..."
 *   - auth object:   { url, authMode, token, customHeaders }
 *   - array of the above (first entry with a valid URL wins)
 */
interface ResolvedWebhook {
  url: string;
  authMode?: 'none' | 'bearer' | 'custom';
  token?: string;
  customHeaders?: Array<{ key: string; value: string }>;
}

@Injectable()
export class DialplanWebhooksService {
  private readonly logger = new Logger(DialplanWebhooksService.name);
  private readonly webhookSecret: string;
  private readonly recordsBaseUrl: string;
  private readonly analyticsPort: HangupAnalyticsPort | null;

  constructor(
    @InjectModel(Route) private readonly routeModel: typeof Route,
    private readonly config: ConfigService,
    private readonly webhookQueue: WebhookQueueService,
    @Optional() @Inject(HANGUP_ANALYTICS_PORT) analyticsPort?: HangupAnalyticsPort | null,
  ) {
    this.webhookSecret = this.config.get<string>('WEBHOOK_SECRET') || '';
    this.recordsBaseUrl =
      this.config.get<string>('RECORDS_BASE_URL')
      || `https://${this.config.get('DOMAIN') || 'localhost'}/records`;
    this.analyticsPort = analyticsPort ?? null;
  }

  // ---------------------------------------------------------------------------
  // custom webhook (DIALTO) — synchronous
  // Asterisk waits for this response to get the responsible employee extension.
  // Returns digits-only string (internal extension) or empty string.
  // ---------------------------------------------------------------------------
  async handleCustomWebhook(params: {
    route_uid: string;
    uniqueid: string;
    clid: string;
    user_uid: string;
  }): Promise<string> {
    const route = await this.findRoute(params.route_uid, params.user_uid);
    const webhook = this.resolveWebhook(route?.webhooks?.custom);
    if (!webhook) return '';

    const payload: WebhookPayload = {
      event: 'custom',
      route_uid: params.route_uid,
      uniqueid: params.uniqueid,
      callerid: params.clid,
      user_uid: params.user_uid,
    };

    try {
      const resp = await axios.post(webhook.url, payload, {
        timeout: 4000, // 4s — Asterisk CURLOPT(timeout)=4 matches this
        headers: this.buildHeaders(payload, webhook),
      });
      // Accept both { responsible_exten: "101" } and plain "101"
      const raw = resp.data?.responsible_exten ?? resp.data ?? '';
      const exten = String(raw).replace(/\D/g, '').substring(0, 10); // digits only, max 10 chars
      this.logger.log(`Custom webhook route=${params.route_uid}: DIALTO=${exten || '(empty)'}`);
      return exten;
    } catch (err: any) {
      // CRM unavailable or timed out — fall through to default routing
      this.logger.warn(`Custom webhook failed route=${params.route_uid}: ${err?.message}`);
      return '';
    }
  }

  // ---------------------------------------------------------------------------
  // before_dial — synchronous (Asterisk waits, CRM registers incoming call)
  // ---------------------------------------------------------------------------
  async handleBeforeDial(params: {
    route_uid: string;
    uniqueid: string;
    clid: string;
    exten: string;
    user_uid: string;
  }): Promise<void> {
    const route = await this.findRoute(params.route_uid, params.user_uid);
    const webhook = this.resolveWebhook(route?.webhooks?.before_dial);
    if (!webhook) return;

    const payload: WebhookPayload = {
      event: 'before_dial',
      route_uid: params.route_uid,
      uniqueid: params.uniqueid,
      callerid: params.clid,
      exten: params.exten,
      user_uid: params.user_uid,
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(webhook.url, payload, {
        timeout: 4000,
        headers: this.buildHeaders(payload, webhook),
      });
    } catch (err: any) {
      // Do not block the call if CRM is unavailable
      this.logger.warn(`before_dial webhook failed route=${params.route_uid}: ${err?.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // on_answer — fire-and-forget with retry (enqueue pattern)
  // Asterisk gets "ok" immediately. CRM delivery is async with exponential retry.
  // ---------------------------------------------------------------------------
  async handleOnAnswer(params: {
    route_uid: string;
    uniqueid: string;
    clid: string;
    member: string;
    source: string;
    user_uid: string;
  }): Promise<void> {
    const route = await this.findRoute(params.route_uid, params.user_uid);
    const webhook = this.resolveWebhook(route?.webhooks?.on_answer);
    if (!webhook) return;

    const payload: WebhookPayload = {
      event: 'on_answer',
      route_uid: params.route_uid,
      uniqueid: params.uniqueid,
      callerid: params.clid,
      member: params.member,
      source: params.source, // 'dial' | 'queue'
      user_uid: params.user_uid,
      timestamp: new Date().toISOString(),
    };

    // Fire-and-forget — Asterisk already returned "ok"
    this.deliverAsync(webhook, payload, 'on_answer');
  }

  // ---------------------------------------------------------------------------
  // on_hangup — fire-and-forget with retry
  // MP3 is guaranteed ready (ffmpeg ran synchronously in [krsk-hangup-handler])
  // Analytics: admit + enqueue only — never STT / scoring / SA-CHARGE-RUN (D-03)
  // ---------------------------------------------------------------------------
  async handleOnHangup(params: {
    route_uid: string;
    uniqueid: string;
    clid: string;
    duration: string;
    disposition: string;
    record_path: string;
    user_uid: string;
  }): Promise<void> {
    const route = await this.findRoute(params.route_uid, params.user_uid);
    const webhook = this.resolveWebhook(route?.webhooks?.on_hangup);

    if (webhook) {
      const recordUrl = params.record_path
        ? `${this.recordsBaseUrl}/${params.record_path}.mp3`
        : null;

      const payload: WebhookPayload = {
        event: 'on_hangup',
        route_uid: params.route_uid,
        uniqueid: params.uniqueid,
        callerid: params.clid,
        duration: parseInt(params.duration, 10) || 0,
        disposition: params.disposition,
        record_path: params.record_path || null,
        // record_url points to the guaranteed-ready MP3
        // ffmpeg ran synchronously in [krsk-hangup-handler] BEFORE this webhook fires
        record_url: recordUrl,
        user_uid: params.user_uid,
        timestamp: new Date().toISOString(),
      };

      this.deliverAsync(webhook, payload, 'on_hangup');
    }

    // Analytics admit/enqueue — no STT. Safe to await here: controller already returned ok to Asterisk.
    try {
      await this.maybeEnqueueHangupAnalysis(route, params);
    } catch (err: any) {
      this.logger.warn(`Hangup analytics enqueue failed route=${params.route_uid}: ${err?.message}`);
    }
  }

  /**
   * Resolve route project + capture/admission gates, then enqueue ai_jobs.
   * Does not import or call pipeline/STT (D-03).
   */
  private async maybeEnqueueHangupAnalysis(
    route: Route | null,
    params: {
      route_uid: string;
      uniqueid: string;
      duration: string;
      record_path: string;
      user_uid: string;
    },
  ): Promise<void> {
    if (!this.analyticsPort || !route) return;

    const routeProjectId = typeof route.options?.analytics?.projectId === 'string'
      ? route.options.analytics.projectId.trim() || null
      : null;
    const recordingEnabled = route.options?.record === true || Boolean(params.record_path);
    const tenantUid = parseInt(params.user_uid, 10);
    const routeUid = parseInt(params.route_uid, 10);
    if (!tenantUid || !routeUid) return;

    const ctx = await this.analyticsPort.resolveHangupContext({
      tenantUid,
      routeUid,
      routeProjectId,
    });

    const durationSec = parseInt(params.duration, 10) || 0;
    const durationMs = durationSec * 1000;
    const decision = decideHangupAnalysisAdmission({
      tenantUid,
      nodeId: ctx.nodeId,
      recordingUid: params.uniqueid || params.record_path || String(routeUid),
      routeProjectId,
      recordingEnabled,
      entitled: ctx.entitled,
      pauseNew: ctx.pauseNew,
      privacyDenied: ctx.privacyDenied,
      projectActive: ctx.projectActive,
      projectPublished: ctx.projectPublished,
      sameTenantProject: ctx.sameTenantProject,
      policyRevision: ctx.policyRevision,
      durationMs,
      // Optimistic: empty/missing file fails in the worker wait, before STT (D-03)
      speechDetected: durationMs >= 400,
      knownOrigins: ctx.knownOrigins,
      assetState: 'ready',
    });

    if (!decision.enqueue || !decision.projectId || !decision.origin) {
      this.logger.debug(
        `Hangup analytics skip route=${params.route_uid} reason=${decision.reason}`,
      );
      return;
    }

    await this.analyticsPort.enqueueAnalysisJob({
      tenantUid,
      routeUid,
      projectId: decision.projectId,
      uniqueid: params.uniqueid,
      recordPath: params.record_path,
      durationSec,
      policyRevision: decision.origin.policyRevision,
      nodeId: decision.origin.nodeId,
      originKey: [
        decision.origin.tenantUid,
        decision.origin.nodeId,
        decision.origin.recordingUid,
        decision.origin.projectId,
        decision.origin.policyRevision,
      ].join(':'),
    });
  }

  // ---------------------------------------------------------------------------
  // on_answer from AMI AgentConnect event (Queue calls)
  // Called by ami.service.ts when AgentConnect AMI event fires
  // ---------------------------------------------------------------------------
  async handleQueueAgentConnect(params: {
    route_uid: string;
    uniqueid: string;
    clid: string;
    member: string;
    queue: string;
    holdtime: string;
    user_uid: string;
  }): Promise<void> {
    const route = await this.findRoute(params.route_uid, params.user_uid);
    const webhook = this.resolveWebhook(route?.webhooks?.on_answer);
    if (!webhook) return;

    const payload: WebhookPayload = {
      event: 'on_answer',
      source: 'queue',
      route_uid: params.route_uid,
      uniqueid: params.uniqueid,
      callerid: params.clid,
      member: params.member,
      queue: params.queue,
      holdtime: parseInt(params.holdtime, 10) || 0,
      user_uid: params.user_uid,
      timestamp: new Date().toISOString(),
    };

    this.deliverAsync(webhook, payload, 'on_answer_queue');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Normalize webhook config from any storage format to ResolvedWebhook.
   *
   * Frontend saves webhooks as:
   *   - Array of string URLs:    ["https://..."]
   *   - Array of auth objects:   [{ url, authMode, token, customHeaders }]
   *   - Mixed arrays (multiple webhooks per event — first entry used for now)
   *   - Legacy plain string:     "https://..."
   *   - Legacy plain object:     { url: "..." }
   *
   * Returns null if no valid URL is found.
   */
  private resolveWebhook(value: any): ResolvedWebhook | null {
    if (!value) return null;

    // Array format: take first entry with a valid URL
    if (Array.isArray(value)) {
      for (const item of value) {
        const resolved = this.resolveWebhook(item);
        if (resolved) return resolved;
      }
      return null;
    }

    // Plain string URL
    if (typeof value === 'string') {
      const url = value.trim();
      return url ? { url, authMode: 'none' } : null;
    }

    // Object format { url, authMode?, token?, customHeaders? }
    if (typeof value === 'object' && value.url) {
      const url = String(value.url).trim();
      if (!url) return null;
      return {
        url,
        authMode: value.authMode || 'none',
        token: value.token || '',
        customHeaders: value.customHeaders || [],
      };
    }

    return null;
  }

  /**
   * Enqueue webhook for persistent delivery via BullMQ (Redis) with retry.
   * Falls back to in-memory setTimeout retry if Redis is not configured.
   *
   * Headers are pre-built here (before enqueue) because ResolvedWebhook
   * is a runtime-only object and cannot be serialized to Redis.
   */
  private deliverAsync(webhook: ResolvedWebhook, payload: WebhookPayload, tag: string): void {
    const headers = this.buildHeaders(payload, webhook);
    // Fire-and-forget: enqueue returns a Promise but we don't await it
    this.webhookQueue.enqueue({ url: webhook.url, payload, headers, tag }).catch((err: any) => {
      this.logger.error(`Failed to enqueue webhook [${tag}]: ${err?.message}`);
    });
  }

  /**
   * Build request headers:
   * - Content-Type: application/json
   * - X-Krasterisk-Version: 4
   * - Authorization: Bearer ... (if authMode === 'bearer')
   * - Custom headers from webhook config (if authMode === 'custom')
   * - X-Krasterisk-Signature: sha256=... (if WEBHOOK_SECRET is set — for CRM verification)
   */
  private buildHeaders(payload: object, webhook?: ResolvedWebhook): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Krasterisk-Version': '4',
    };

    if (webhook?.authMode === 'bearer' && webhook.token) {
      headers['Authorization'] = `Bearer ${webhook.token}`;
    } else if (webhook?.authMode === 'custom' && webhook.customHeaders?.length) {
      for (const h of webhook.customHeaders) {
        if (h.key?.trim()) headers[h.key.trim()] = h.value || '';
      }
    }

    if (this.webhookSecret) {
      const sig = createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-Krasterisk-Signature'] = `sha256=${sig}`;
    }

    return headers;
  }

  /**
   * Find route by UID + user_uid without JWT — internal requests come from Asterisk dialplan.
   * Route UID and user_uid are set as dialplan variables (__HH_ROUTE_UID, CDR(vpbx_user_uid)).
   */
  private async findRoute(routeUid: string, userUid: string): Promise<Route | null> {
    const uid = parseInt(routeUid, 10);
    const user_uid = parseInt(userUid, 10);
    if (!uid || isNaN(user_uid)) return null;
    return this.routeModel.findOne({ where: { uid, user_uid } });
  }
}
