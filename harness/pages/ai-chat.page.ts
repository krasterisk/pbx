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

  async send(text: string, timeouts: { startMs?: number; idleMs?: number } = {}): Promise<void> {
    await expect(this.input).toBeEnabled({ timeout: 15_000 });
    await this.input.fill(text);
    await this.input.press('Enter');
    await expect.poll(async () => {
      const label = await this.sendButton.getAttribute('aria-label').catch(() => null);
      const progress = await this.busyCount();
      const cards = await this.cards.count();
      const steps = await this.steps.count();
      const kinds = await this.timeline.locator('[data-kind]').count();
      return /Остановить|Stop/i.test(label || '')
        || progress > 0
        || cards > 0
        || steps > 0
        || kinds > 0;
    }, { timeout: timeouts.startMs ?? 30_000 }).toBeTruthy();
    await this.waitForIdle(timeouts.idleMs);
  }

  async waitForIdle(timeoutMs = 60_000): Promise<void> {
    await expect.poll(async () => {
      const label = await this.sendButton.getAttribute('aria-label').catch(() => null);
      return /Отправить|Send/i.test(label || '') && (await this.busyCount()) === 0;
    }, { timeout: timeoutMs }).toBeTruthy();
  }

  async outcomeText(): Promise<string> {
    const node = this.page.getByTestId('ai-agent-outcome');
    if (await node.count() === 0) return '';
    return (await node.innerText()).trim();
  }

  private async busyCount(): Promise<number> {
    const progress = await this.page.getByTestId('ai-agent-progress').count();
    const working = await this.page.getByTestId('ai-agent-working').count();
    return progress + working;
  }

  async applyFirstCard(): Promise<void> {
    const card = this.cards.first();
    await card.getByRole('button', { name: /Применить изменения|Повторить|Apply|Retry/i }).click();
    await expect(card).toHaveAttribute('data-status', /applied|denied|rejected|failed|expired/, {
      timeout: 60_000,
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

  async stepLabels(): Promise<string[]> {
    return (await this.steps.getByTestId('ai-agent-step-label').allTextContents())
      .map((label) => label.trim())
      .filter(Boolean);
  }

  async visibleText(): Promise<string> {
    return (await this.panel.innerText()).trim();
  }
}
