import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures/auth.fixture';
import { AiChatPage } from '../../pages/ai-chat.page';
import { PLACEHOLDER, PLAN_STEP, RAW_TOOLS, STEP_LIMIT, isLiveLlm } from './horns-hooves';
import { liveIvrCases, type LiveIvrCase } from './live-ivr-cases';

/**
 * Live gate — real tenant provider, real chat, no llm-stub.
 *
 *   npm run harness:ai-chat:live
 *
 * Complete IVR briefs compile on the server (no qwen JSON). The model is only
 * a fallback when the brief is incomplete. CI never sets HARNESS_LIVE_LLM.
 */
const API = (process.env.HARNESS_API_URL || 'http://localhost:5010').replace(/\/$/, '');
const LIVE_START_MS = 20_000;
const LIVE_IDLE_MS = 30_000;
const APPLY_MS = 90_000;

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiJson<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`${path} ${res.status}: ${await res.text().catch(() => '')}`);
  }
  return res.json() as Promise<T>;
}

async function requireLiveProvider(token: string): Promise<void> {
  const pinned = Number(process.env.HARNESS_AI_PROVIDER_UID || 0);
  if (pinned > 0) {
    await apiJson(token, '/ai-chat/default-provider', {
      method: 'PUT',
      body: JSON.stringify({ providerUid: pinned }),
    });
  }
  const providers = await apiJson<Array<{ uid?: number; name?: string }>>(token, '/ai-agents/providers/list');
  expect(providers.length, 'Tenant has no LLM provider — configure one in AI Agents').toBeGreaterThan(0);
  const chosen = await apiJson<{ providerUid: number | null }>(token, '/ai-chat/default-provider');
  const uid = chosen.providerUid ?? providers[0]?.uid;
  expect(uid, 'No default chat provider').toBeTruthy();
}

async function findIvrByName(token: string, name: string): Promise<{ name?: string } | undefined> {
  const ivrs = await apiJson<Array<{ name?: string }>>(token, '/ivrs');
  return ivrs.find((row) => String(row.name ?? '').includes(name));
}

async function findQueueByName(token: string, name: string): Promise<{ name?: string; display_name?: string } | undefined> {
  const queues = await apiJson<Array<{ name?: string; display_name?: string }>>(token, '/queues');
  return queues.find((row) => `${row.display_name ?? ''} ${row.name ?? ''}`.includes(name));
}

test.describe.configure({ mode: 'default' });

const cases = liveIvrCases();

for (const liveCase of cases) {
  test(`live IVR ${liveCase.id}: ${liveCase.title}`, async ({ authenticatedPage, authSession }) => {
    test.skip(!isLiveLlm(), 'Run with npm run harness:ai-chat:live (sets HARNESS_LIVE_LLM=1)');
    test.setTimeout(8 * 60_000);
    await runLiveIvr(authenticatedPage, authSession.accessToken, liveCase);
  });
}

async function runLiveIvr(page: Page, token: string, live: LiveIvrCase): Promise<void> {
  await requireLiveProvider(token);

  const chat = new AiChatPage(page);
  await chat.open();
  await chat.startNewConversation();
  const started = Date.now();
  await chat.send(live.prompt, { startMs: LIVE_START_MS, idleMs: LIVE_IDLE_MS });
  const elapsed = Date.now() - started;

  const visible = await chat.visibleText();
  const outcome = await chat.outcomeText();
  expect(visible, visible).not.toMatch(STEP_LIMIT);
  expect(outcome, `turn ended with "${outcome}"`).not.toMatch(/таймаут|timeout|Остановлено|Stopped|Не удалось|Could not|лимит шагов/i);

  const planLabels = (await chat.stepLabels()).filter((label) => PLAN_STEP.test(label));
  expect(planLabels.length, `plan step repeated: ${planLabels.join(' | ')}`).toBeLessThanOrEqual(2);
  expect(elapsed, `card should compile without a model loop (${elapsed}ms)`).toBeLessThan(30_000);

  await expect(chat.cards).toHaveCount(1);
  const card = chat.cards.first();
  await expect(card).toBeVisible({ timeout: 5_000 });
  for (const pattern of live.card) {
    await expect(card).toContainText(pattern);
  }

  const markup = await chat.markup();
  expect(markup).not.toMatch(PLACEHOLDER);
  expect(markup).not.toMatch(RAW_TOOLS);
  expect(markup).not.toMatch(/applyPayload|proposalId|tool_call|WORKFLOW_REFUSED/);

  await chat.applyFirstCard();
  await expect(card).toHaveAttribute('data-status', 'applied', { timeout: APPLY_MS });

  await expect.poll(async () => {
    const ivr = await findIvrByName(token, live.name);
    return ivr?.name ?? '';
  }, { timeout: 30_000 }).toContain(live.name);

  if (live.expectQueue) {
    await expect.poll(async () => {
      const queue = await findQueueByName(token, live.expectQueue ?? '');
      return `${queue?.display_name ?? ''} ${queue?.name ?? ''}`;
    }, { timeout: 15_000 }).toMatch(new RegExp(live.expectQueue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}
