import axios from 'axios';
import type { SaWebhookEvent } from '@krasterisk/shared';
import type { WebhookJobData } from '../../routes/webhook-queue.service';
import { ProjectEditorError } from './project-editor.service';

export type SaWebhookQueue = {
  enqueue(data: WebhookJobData): Promise<void>;
};

export type SaHttpPoster = (input: {
  url: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  timeoutMs?: number;
}) => Promise<{ ok: boolean; status: number; error?: string }>;

export type TenantIntegrationRef = {
  uid: number;
  tenantUid: number;
};

export function buildSaEventPayload(input: {
  event: SaWebhookEvent;
  projectId: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    event: input.event,
    projectId: input.projectId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    data: input.data ?? {},
  };
}

/** Reject integration uids that do not belong to this tenant (D-29 / T-18-06-INT). */
export function assertIntegrationsForTenant(
  tenantUid: number,
  uids: readonly number[],
  catalog: readonly TenantIntegrationRef[],
): void {
  if (!uids.length) return;
  const byUid = new Map(catalog.map((row) => [row.uid, row]));
  for (const uid of uids) {
    const row = byUid.get(uid);
    if (!row || row.tenantUid !== tenantUid) {
      throw new ProjectEditorError('foreign_integration', 403, String(uid));
    }
  }
}

export async function enqueueSaEventWebhook(
  queue: SaWebhookQueue,
  input: {
    url: string;
    headers: Record<string, string>;
    event: SaWebhookEvent;
    projectId: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  const payload = buildSaEventPayload({
    event: input.event,
    projectId: input.projectId,
    data: input.data,
  });
  await queue.enqueue({
    url: input.url,
    headers: { ...input.headers },
    payload,
    tag: `${input.event}:${input.projectId}`,
  });
}

/** Default real HTTP poster for the Test button (D-30). */
export const axiosSaHttpPoster: SaHttpPoster = async (input) => {
  try {
    const response = await axios.post(input.url, input.payload, {
      timeout: input.timeoutMs ?? 10_000,
      headers: input.headers,
      validateStatus: () => true,
    });
    const ok = response.status >= 200 && response.status < 300;
    return {
      ok,
      status: response.status,
      error: ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'request_failed';
    return { ok: false, status: 0, error: message };
  }
};

/** Test button: real HTTP with configured headers (D-30). */
export async function testSaEventWebhook(
  poster: SaHttpPoster,
  input: {
    url: string;
    headers: Record<string, string>;
    projectId: string;
  },
): Promise<{ ok: boolean; status: number; error?: string }> {
  const payload = buildSaEventPayload({
    event: 'analysis.completed',
    projectId: input.projectId,
    data: { test: true },
  });
  return poster({
    url: input.url,
    headers: { ...input.headers },
    payload,
  });
}

/** Clear projectId from route analytics options so auto-analysis stops (D-31). */
export function clearRouteAnalyticsProject(
  options: Record<string, unknown> | null | undefined,
  projectId: string,
): Record<string, unknown> | null {
  if (!options) return null;
  const next = { ...options };
  const analytics = next.analytics;
  if (analytics && typeof analytics === 'object' && !Array.isArray(analytics)) {
    const current = analytics as Record<string, unknown>;
    if (current.projectId === projectId) {
      next.analytics = { ...current, projectId: null };
    }
  }
  return next;
}

export type DeleteProjectEffects = {
  keepConversations: true;
  clearRouteSelection: true;
  revokeTokens: true;
  refund: false;
};

/** Delete project effects (D-31): keep conversations, clear routes, revoke tokens, no refund. */
export function planDeleteProjectEffects(): DeleteProjectEffects {
  return {
    keepConversations: true,
    clearRouteSelection: true,
    revokeTokens: true,
    refund: false,
  };
}
