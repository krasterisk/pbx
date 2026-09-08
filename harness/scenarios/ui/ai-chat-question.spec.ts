import { expect, test } from '../../fixtures/ai-provider.fixture';
import { AiChatPage } from '../../pages/ai-chat.page';

test.describe.configure({ mode: 'serial' });

test('a question closes the turn as the last item and leaves the composer usable', async ({
  authenticatedPage,
  llmStub,
  stubProvider,
}) => {
  expect(stubProvider.uid).toBeGreaterThan(0);
  llmStub.useScenario('question-order');
  const chat = new AiChatPage(authenticatedPage);
  await chat.open();
  await chat.startNewConversation();
  await chat.send('Какой номер использовать для группы?');
  const kinds = await chat.timelineKinds();
  expect(kinds.at(-1)).toBe('assistant');
  await expect(chat.input).toBeEnabled();
});
