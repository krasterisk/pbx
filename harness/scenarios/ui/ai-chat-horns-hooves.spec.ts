import { expect, test } from '../../fixtures/ai-provider.fixture';
import { AiChatPage } from '../../pages/ai-chat.page';
import {
  HORNS_DIGITS,
  HORNS_GREETING,
  HORNS_PROMPT,
  HORNS_TITLE,
  PLACEHOLDER,
  RAW_TOOLS,
} from './horns-hooves';

test.describe.configure({ mode: 'serial' });

// Scripted llm-stub (CI). Live model: ai-chat-horns-hooves.live.spec.ts + HARNESS_LIVE_LLM=1.
test('horns-and-hooves IVR shows useful steps once and one plan card', async ({
  authenticatedPage,
  llmStub,
  stubProvider,
}) => {
  expect(stubProvider.uid).toBeGreaterThan(0);
  llmStub.useScenario('plan-horns-hooves');

  const chat = new AiChatPage(authenticatedPage);
  await chat.open();
  await chat.startNewConversation();
  await chat.send(HORNS_PROMPT);

  await expect(chat.panel.getByText(HORNS_TITLE).first()).toBeVisible();
  await expect(chat.cards).toHaveCount(1);

  const card = chat.cards.first();
  await expect(card).toContainText(HORNS_TITLE);
  const stepCount = await card.getByTestId('ai-agent-workflow-steps').getByRole('listitem').count();
  expect(stepCount).toBeGreaterThanOrEqual(2);
  expect(stepCount).toBeLessThanOrEqual(3);
  await expect(card).toContainText(HORNS_GREETING);
  await expect(card).toContainText(HORNS_DIGITS);
  await expect(card).not.toContainText(/engine_uid|→ extension |→ group /i);
  await expect(card.getByTestId('ai-agent-workflow-steps')).toContainText(/групп|меню|Группа|Меню|call group|IVR/i);

  await expect(chat.steps).toHaveCount(3);
  const labels = (await chat.steps.locator('[class*="stepLabel"]').allTextContents())
    .map((label) => label.trim());
  expect(labels[0]).toMatch(/Смотрю голосовые движки|Looking up speech engines/);
  expect(labels[1]).toMatch(/Смотрю абонентов|Looking up subscribers/);
  expect(labels[2]).toMatch(/Собираю план изменений|Assembling a change plan/);
  expect(new Set(labels).size).toBe(3);

  const engines = chat.steps.nth(0);
  const subscribers = chat.steps.nth(1);
  const plan = chat.steps.nth(2);

  await engines.getByRole('button').click();
  await expect(engines.getByTestId('ai-agent-step-detail')).toHaveText(
    /Движки:|Голосовых движков нет|Engines:|No speech engines/i,
  );

  await subscribers.getByRole('button').click();
  await expect(subscribers.getByTestId('ai-agent-step-detail')).toHaveText(
    /Абоненты:|Абонентов с такими номерами нет|Subscribers:|No subscribers/i,
  );

  await expect(plan.getByRole('button')).toHaveCount(0);
  await expect(plan.getByTestId('ai-agent-step-detail')).toHaveCount(0);

  const markup = await chat.markup();
  expect(markup).not.toMatch(PLACEHOLDER);
  expect(markup).not.toMatch(RAW_TOOLS);
  expect(markup).not.toMatch(/applyPayload|proposalId|tool_call|WORKFLOW_REFUSED/);
});
