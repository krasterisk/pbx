import { expect, test } from '../../fixtures/ai-provider.fixture';
import { AiChatPage } from '../../pages/ai-chat.page';

const HISTORY_PROMPT = 'Покажи очереди';

test.describe.configure({ mode: 'serial' });

test('a reloaded thread renders exactly the live timeline', async ({ authenticatedPage, llmStub, stubProvider }) => {
  expect(stubProvider.uid).toBeGreaterThan(0);
  llmStub.useScenario('steps-then-answer');
  const chat = new AiChatPage(authenticatedPage);
  await chat.open();
  await chat.startNewConversation();
  await chat.send(HISTORY_PROMPT);
  const thread = authenticatedPage.getByRole('option', { name: HISTORY_PROMPT }).first();
  await expect(thread).toBeVisible();
  const live = await chat.timelineKinds();
  const liveText = await chat.timeline.innerText();
  await authenticatedPage.reload();
  await chat.open();
  await authenticatedPage.getByRole('option', { name: HISTORY_PROMPT }).first().click();
  await expect.poll(async () => chat.timelineKinds(), { timeout: 20_000 }).toEqual(live);
  expect(await chat.timeline.innerText()).toBe(liveText);
});

test('reasoning never reaches the browser', async ({ authenticatedPage, llmStub, stubProvider }) => {
  expect(stubProvider.uid).toBeGreaterThan(0);
  llmStub.useScenario('steps-then-answer');
  const chat = new AiChatPage(authenticatedPage);
  await chat.open();
  await chat.startNewConversation();
  await chat.send(HISTORY_PROMPT);
  expect(await chat.markup()).not.toContain('сначала посмотрю');
});
