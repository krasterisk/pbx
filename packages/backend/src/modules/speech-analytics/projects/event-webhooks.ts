import type { SaWebhookEvent } from '@krasterisk/shared';
import type { WebhookJobData } from '../../routes/webhook-queue.service';

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

/** Reject integration uids that do not belong to this tenant (D-29 / T-18-06-INT). RED stub: accepts all. */
export function assertIntegrationsForTenant(
  tenantUid: number,
  uids: readonly number[],
  catalog: readonly TenantIntegrationRef[],
): void {
  void tenantUid;
  void uids;
  void catalog;
  // INTENTIONAL RED: no foreign-tenant rejection
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

/**
 * Test button: real HTTP with configured headers (D-30).
 * RED stub: skips HTTP and always reports success.
 */
export async function testSaEventWebhook(
  _poster: SaHttpPoster,
  input: {
    url: string;
    headers: Record<string, string>;
    projectId: string;
  },
): Promise<{ ok: boolean; status: number; error?: string }> {
  void input;
  return { ok: true, status: 200 };
}

/** Clear projectId from route analytics options (D-31). RED stub: leaves projectId. */
export function clearRouteAnalyticsProject(
  options: Record<string, unknown> | null | undefined,
  projectId: string,
): Record<string, unknown> | null {
  void projectId;
  if (!options) return null;
  return { ...options };
}

export type DeleteProjectEffects = {
  keepConversations: true;
  clearRouteSelection: true;
  revokeTokens: true;
  refund: false;
};

/** Delete project effects (D-31). RED stub claims refund. */
export function planDeleteProjectEffects(): DeleteProjectEffects {
  return {
    keepConversations: true,
    clearRouteSelection: true,
    revokeTokens: true,
    // INTENTIONAL RED: delete must never refund
    refund: true,
  } as DeleteProjectEffects;
}
