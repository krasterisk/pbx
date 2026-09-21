import { expect, test } from '../../fixtures/ai-provider.fixture';
import { AiChatPage } from '../../pages/ai-chat.page';
import {
  HORNS_DIGITS,
  HORNS_GREETING,
  HORNS_PROMPT,
  HORNS_TITLE,
  PLACEHOLDER,
  PLAN_STEP,
  RAW_TOOLS,
} from './horns-hooves';

test.describe.configure({ mode: 'serial' });

// Scripted llm-stub (CI). Complete briefs compile on the server (tryServerIvrPlan);
// discovery tool turns are only a fallback when the brief is incomplete.
// Live model: ai-chat-horns-hooves.live.spec.ts + HARNESS_LIVE_LLM=1.
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

  const labels = await chat.stepLabels();
  expect(labels.length).toBeGreaterThanOrEqual(1);
  expect(labels.length).toBeLessThanOrEqual(3);
  const planLabels = labels.filter((label) => PLAN_STEP.test(label));
  expect(planLabels.length, `plan step labels: ${labels.join(' | ')}`).toBeGreaterThanOrEqual(1);
  // Live SSE + thread refetch can briefly leave two plan rows with the same label.
  expect(planLabels.length, `plan step repeated: ${labels.join(' | ')}`).toBeLessThanOrEqual(2);

  const engines = chat.steps.filter({ hasText: /Смотрю голосовые движки|Looking up speech engines/ });
  if (await engines.count()) {
    await engines.first().getByRole('button').click();
    await expect(engines.first().getByTestId('ai-agent-step-detail')).toHaveText(
      /Движки:|Голосовых движков нет|Engines:|No speech engines/i,
    );
  }

  const subscribers = chat.steps.filter({ hasText: /Смотрю абонентов|Looking up subscribers/ });
  if (await subscribers.count()) {
    await subscribers.first().getByRole('button').click();
    await expect(subscribers.first().getByTestId('ai-agent-step-detail')).toHaveText(
      /Абоненты:|Абонентов с такими номерами нет|Subscribers:|No subscribers/i,
    );
  }

  // Prefer the non-expandable plan row (compile success has no detail).
  const plan = chat.steps.filter({ hasText: PLAN_STEP }).last();
  await expect(plan).toBeVisible();

  const markup = await chat.markup();
  expect(markup).not.toMatch(PLACEHOLDER);
  expect(markup).not.toMatch(RAW_TOOLS);
  expect(markup).not.toMatch(/applyPayload|proposalId|tool_call|WORKFLOW_REFUSED/);
});
