import { expect, type Locator, type Page } from '@playwright/test';

export class AiChatPage {
  constructor(private readonly page: Page) {}

  get panel(): Locator { return this.page.getByTestId('ai-agent-panel'); }
  get timeline(): Locator { return this.page.getByTestId('ai-agent-timeline'); }
  get input(): Locator { return this.page.locator('#ai-chat-input'); }
  get sendButton(): Locator { return this.page.locator('#ai-chat-send'); }
  get cards(): Locator { return this.page.getByTestId('ai-agent-diff-card'); }
  get steps(): Locator { return this.page.getByTestId('ai-agent-step'); }

  async open(): Promise<void> {
    await this.page.goto('/');
    await expect(this.page.getByTestId('module-shell')).toBeVisible({ timeout: 20_000 });
    await this.page.locator('#shell-agent-trigger').click();
    await expect(this.panel).toHaveAttribute('data-open', 'true');
    await expect(this.panel.getByText(/AI-ассистент|AI Assistant/i).first()).toBeVisible();
  }

  async startNewConversation(): Promise<void> {
    await this.page.getByRole('button', { name: /Новый разговор|New conversation/i }).click();
    await expect(this.page.getByRole('option', { selected: true })).toBeVisible({ timeout: 15_000 });
  }

  async send(text: string): Promise<void> {
    await expect(this.input).toBeEnabled({ timeout: 15_000 });
    await this.input.fill(text);
    await this.input.press('Enter');
    await expect.poll(async () => {
      const label = await this.sendButton.getAttribute('aria-label').catch(() => null);
      const progress = await this.page.getByTestId('ai-agent-progress').count();
      const cards = await this.cards.count();
      const steps = await this.steps.count();
      const kinds = await this.timeline.locator('[data-kind]').count();
      return /Остановить|Stop/i.test(label || '')
        || progress > 0
        || cards > 0
        || steps > 0
        || kinds > 0;
    }, { timeout: 30_000 }).toBeTruthy();
    await this.waitForIdle();
  }

  async waitForIdle(): Promise<void> {
    await expect.poll(async () => {
      const label = await this.sendButton.getAttribute('aria-label').catch(() => null);
      const progress = await this.page.getByTestId('ai-agent-progress').count();
      return /Отправить|Send/i.test(label || '') && progress === 0;
    }, { timeout: 60_000 }).toBeTruthy();
  }

  async applyFirstCard(): Promise<void> {
    const card = this.cards.first();
    await card.getByRole('button', { name: /Применить изменения|Повторить|Apply|Retry/i }).click();
    await expect(card).toHaveAttribute('data-status', /applied|denied|rejected|pending|failed|expired/, {
      timeout: 30_000,
    });
  }

  async timelineKinds(): Promise<string[]> {
    return this.timeline.locator('[data-kind]').evaluateAll((nodes) => (
      nodes.map((node) => node.getAttribute('data-kind') ?? '')
    ));
  }

  async markup(): Promise<string> {
    return this.panel.innerHTML();
  }
}
