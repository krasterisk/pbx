import { expect, test } from '../../fixtures/ai-provider.fixture';
import { AiChatPage } from '../../pages/ai-chat.page';

const PLAN_PROMPT = 'Создай IVR Приёмная: 1→321, 2→322, 3→323, таймаут — группа 321-323';

test.describe.configure({ mode: 'serial' });

test('several changes arrive as one plan card', async ({ authenticatedPage, llmStub, stubProvider }) => {
  expect(stubProvider.uid).toBeGreaterThan(0);
  llmStub.useScenario('plan-ivr');
  const chat = new AiChatPage(authenticatedPage);
  await chat.open();
  await chat.startNewConversation();
  await chat.send(PLAN_PROMPT);
  await expect(chat.cards).toHaveCount(1);
  await expect(chat.cards.first().getByTestId('ai-agent-workflow-steps').getByRole('listitem')).toHaveCount(3);
});

test('the panel shows no technical data', async ({ authenticatedPage, llmStub, stubProvider }) => {
  expect(stubProvider.uid).toBeGreaterThan(0);
  llmStub.useScenario('plan-ivr');
  const chat = new AiChatPage(authenticatedPage);
  await chat.open();
  await chat.startNewConversation();
  await chat.send(PLAN_PROMPT);
  await expect(chat.cards).toHaveCount(1);
  const markup = await chat.markup();
  expect(markup).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  expect(markup).not.toMatch(/\bq\w+_\d+\b/);
  expect(markup).not.toMatch(/\b(e|ew)\d+_\d+\b/);
  expect(markup).not.toMatch(/applyPayload|proposalId|tool_call/);
});
