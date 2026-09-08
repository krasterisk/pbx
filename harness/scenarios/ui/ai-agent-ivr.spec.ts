import { expect, test, type Page } from '../../fixtures/auth.fixture';

/**
 * AI Agent chat — create an IVR through the real web UI.
 *
 * Always-on smoke: open the assistant, start a conversation, see composer.
 * Live LLM (HARNESS_LIVE_LLM=1): type the request, wait for answers, apply
 * proposal cards, send follow-ups until endpoints + timeout group + IVR exist.
 */

const API = (process.env.HARNESS_API_URL || 'http://localhost:5010').replace(/\/$/, '');
const PROVIDER_UID = Number(process.env.HARNESS_AI_PROVIDER_UID || 16);
const IVR_NAME = 'Приёмная';
const GREETING =
  'Вы позвонили в приёмную. Нажмите 1 для записи, 2 для справочной, 3 для канцелярии, или оставайтесь на линии';
const EXT = { one: '321', two: '322', three: '323' } as const;
const GROUP_EXTEN = '9032';

const CREATE_PROMPT =
  `Создай IVR - ${IVR_NAME}, текст: "${GREETING}" ` +
  `Пункты: 1 - Абонент ${EXT.one} 2 - ${EXT.two} 3 - ${EXT.three} ` +
  `ничего не нажали - группа ${EXT.one}-${EXT.three}`;

type ReadySnap = {
  ok: boolean;
  hasOne: boolean;
  hasTwo: boolean;
  hasThree: boolean;
  group: { exten?: string } | undefined;
  ivr: { name?: string } | undefined;
};

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

async function snapshot(token: string): Promise<ReadySnap> {
  const [ivrs, groups, endpoints] = await Promise.all([
    apiJson<Array<{ name?: string }>>(token, '/ivrs'),
    apiJson<Array<{ name?: string; exten?: string }>>(token, '/call-groups'),
    apiJson<unknown>(token, '/endpoints'),
  ]);
  const list = Array.isArray(endpoints)
    ? endpoints
    : ((endpoints as { items?: unknown[]; data?: unknown[] }).items
      ?? (endpoints as { data?: unknown[] }).data
      ?? []) as Array<{ extension?: string; sipUsername?: string; id?: string }>;
  const has = (n: string) =>
    list.some((row) => String(row.extension) === n || String(row.sipUsername ?? row.id ?? '').includes(n));
  const group = groups.find((row) =>
    String(row.exten) === GROUP_EXTEN || new RegExp(`${EXT.one}-${EXT.three}|приёмн`, 'i').test(String(row.name)),
  );
  const ivr = ivrs.find((row) => new RegExp(IVR_NAME, 'i').test(String(row.name)));
  return {
    ok: !!(group && ivr && has(EXT.one) && has(EXT.two) && has(EXT.three)),
    hasOne: has(EXT.one),
    hasTwo: has(EXT.two),
    hasThree: has(EXT.three),
    group,
    ivr,
  };
}

function followUp(ready: ReadySnap): string {
  if (!ready.hasTwo) {
    return `Абонент ${EXT.one} уже есть. Вызови только create_endpoint для ${EXT.two}. Не создавай IVR.`;
  }
  if (!ready.hasThree) {
    return `Абоненты ${EXT.one} и ${EXT.two} уже есть. Вызови только create_endpoint для ${EXT.three}.`;
  }
  const groupExten = ready.group?.exten ? String(ready.group.exten) : GROUP_EXTEN;
  if (!ready.group) {
    return (
      `Абоненты ${EXT.one}, ${EXT.two}, ${EXT.three} уже есть. Не создавай абонентов. ` +
      `Вызови только create_call_group: name="Группа ${GROUP_EXTEN}", exten="${GROUP_EXTEN}", ` +
      `members=[{member_type:"internal",value:"${EXT.one}"},{value:"${EXT.two}"},{value:"${EXT.three}"}].`
    );
  }
  return (
    `Абоненты ${EXT.one}/${EXT.two}/${EXT.three} и группа ${groupExten} уже существуют. Не создавай их снова. ` +
    `Сразу вызови create_ivr одним объектом: name="${IVR_NAME}", prompts TTS Яндекс, ` +
    `menu_items 1→${EXT.one} 2→${EXT.two} 3→${EXT.three} t→group ${groupExten}.`
  );
}

async function openAssistant(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('module-shell')).toBeVisible();
  await page.locator('#shell-agent-trigger').click();
  const panel = page.getByTestId('ai-agent-panel');
  await expect(panel).toHaveAttribute('data-open', 'true');
  await expect(panel.getByText(/AI-ассистент|AI Assistant/i).first()).toBeVisible();
}

async function startNewConversation(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Новый разговор|New conversation/i }).click();
  await expect(page.getByRole('option', { selected: true })).toBeVisible({ timeout: 15_000 });
}

async function waitForTurnIdle(page: Page): Promise<void> {
  const send = page.locator('#ai-chat-send');
  const messages = page.getByTestId('ai-agent-messages');
  await expect.poll(async () => {
    const label = await send.getAttribute('aria-label');
    const progress = await page.getByTestId('ai-agent-progress').count();
    const cards = await page.getByTestId('ai-agent-diff-card').count();
    const text = await messages.innerText();
    return /Остановить|Stop/i.test(label || '')
      || progress > 0
      || cards > 0
      || /Приёмная|create_ivr|create_endpoint|create_call_group/i.test(text);
  }, { timeout: 45_000 }).toBeTruthy();

  await expect.poll(async () => {
    const label = await send.getAttribute('aria-label');
    const progress = await page.getByTestId('ai-agent-progress').count();
    return /Отправить|Send/i.test(label || '') && progress === 0;
  }, { timeout: 180_000 }).toBeTruthy();
}

async function sendChat(page: Page, text: string): Promise<void> {
  const input = page.locator('#ai-chat-input');
  await input.fill(text);
  await input.press('Enter');
  await waitForTurnIdle(page);
}

async function applyPendingCards(page: Page): Promise<number> {
  const cards = page.locator('[data-testid="ai-agent-diff-card"][data-status="pending"], [data-testid="ai-agent-diff-card"][data-status="failed"]');
  const count = await cards.count();
  let applied = 0;
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    const action = card.getByRole('button', { name: /Применить изменения|Повторить|Apply|Retry/i });
    if (!(await action.isVisible().catch(() => false))) continue;
    await action.click();
    await expect(card).toHaveAttribute('data-status', /applied|denied|rejected|pending|failed|expired/, {
      timeout: 30_000,
    });
    applied += 1;
  }
  return applied;
}

test.describe('AI Agent chat — IVR', () => {
  test('opens the assistant, starts a conversation and shows the composer', async ({ authenticatedPage: page }) => {
    await openAssistant(page);
    await expect(page.getByTestId('ai-agent-messages')).toContainText(/настроить АТС|set up/i);
    await startNewConversation(page);
    await expect(page.getByTestId('ai-agent-composer')).toBeVisible();
    await expect(page.locator('#ai-chat-input')).toBeEnabled();
    await expect(page.getByRole('button', { name: /Отправить|Send/i })).toBeVisible();
  });

  test('creates an IVR through chat turns, follow-ups and apply cards', async ({
    authenticatedPage: page,
    authSession,
  }) => {
    test.skip(!process.env.HARNESS_LIVE_LLM, 'Set HARNESS_LIVE_LLM=1 to run the live AI Agent IVR UI flow');
    test.setTimeout(15 * 60_000);

    await apiJson(authSession.accessToken, '/ai-chat/default-provider', {
      method: 'PUT',
      body: JSON.stringify({ providerUid: PROVIDER_UID }),
    });

    await openAssistant(page);
    await startNewConversation(page);

    await sendChat(page, CREATE_PROMPT);

    for (let turn = 1; turn <= 12; turn += 1) {
      await expect(page.getByTestId('ai-agent-messages')).toContainText(new RegExp(IVR_NAME, 'i'));
      await applyPendingCards(page);
      const ready = await snapshot(authSession.accessToken);
      if (ready.ok) {
        await expect(page.getByTestId('ai-agent-diff-card').filter({ hasText: new RegExp(IVR_NAME, 'i') }).first())
          .toHaveAttribute('data-status', 'applied', { timeout: 10_000 })
          .catch(() => undefined);
        expect(ready.ivr?.name).toMatch(new RegExp(IVR_NAME, 'i'));
        return;
      }
      await sendChat(page, `Подтверждаю.\n${followUp(ready)}`);
    }

    throw new Error(`IVR "${IVR_NAME}" was not created after UI retries`);
  });
});
