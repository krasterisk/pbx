import { expect, test } from '../../fixtures/ai-provider.fixture';
import { AiChatPage } from '../../pages/ai-chat.page';

test.describe.configure({ mode: 'serial' });

async function expectPlan(chat: AiChatPage, title: string, labels: string[]): Promise<void> {
  await expect(chat.cards).toHaveCount(1);
  const card = chat.cards.first();
  await expect(card).toContainText(title);
  await expect(card.getByTestId('ai-agent-workflow-steps').getByRole('listitem')).toHaveCount(3);
  for (const label of labels) {
    await expect(card).toContainText(new RegExp(label, 'i'));
  }
}

test('reception setup proposes subscribers, a ring group and an IVR', async ({
  authenticatedPage,
  llmStub,
  stubProvider,
}) => {
  expect(stubProvider.uid).toBeGreaterThan(0);
  llmStub.useScenario('plan-reception');
  const chat = new AiChatPage(authenticatedPage);
  await chat.open();
  await chat.startNewConversation();
  await chat.send('Создай IVR Приёмная: 1→321, 2→322, 3→323, таймаут — группа 321-323');
  await expectPlan(chat, 'Приёмная', ['абонент', 'Приёмная']);
});

test('contact-center setup proposes two queues and an IVR', async ({
  authenticatedPage,
  llmStub,
  stubProvider,
}) => {
  expect(stubProvider.uid).toBeGreaterThan(0);
  llmStub.useScenario('plan-queues');
  const chat = new AiChatPage(authenticatedPage);
  await chat.open();
  await chat.startNewConversation();
  await chat.send('Собери контакт-центр: очереди Sales и Support, IVR 1→Sales 2→Support');
  await expectPlan(chat, 'Контакт-центр', ['Sales', 'Support']);
});

test('trunk office setup proposes a directory, a SIP trunk and subscribers', async ({
  authenticatedPage,
  llmStub,
  stubProvider,
}) => {
  expect(stubProvider.uid).toBeGreaterThan(0);
  llmStub.useScenario('plan-trunk');
  const chat = new AiChatPage(authenticatedPage);
  await chat.open();
  await chat.startNewConversation();
  await chat.send('Добавь справочник VIP, транк MTT и абонентов 201-202');
  await expectPlan(chat, 'Транк и справочник', ['VIP', 'MTT']);
});
