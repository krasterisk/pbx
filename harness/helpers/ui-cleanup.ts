import { expect, type Page } from '@playwright/test';

/** Close the docked AI assistant if a prior test left it open (shared worker page). */
export async function closeAssistantIfOpen(page: Page): Promise<void> {
  const panel = page.getByTestId('ai-agent-panel');
  if ((await panel.count()) === 0) return;
  if ((await panel.getAttribute('data-open')) !== 'true') return;
  const close = page.getByRole('button', { name: /Close panel|Закрыть панель/i });
  if (await close.count()) {
    await close.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await expect.poll(async () => panel.getAttribute('data-open')).toBe('false');
}
