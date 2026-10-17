import { test, expect } from '../fixtures/auth.fixture';

/**
 * CC-1e happy path:
 *   Off shift, the operator sees the start screen and its Start shift action.
 *   On shift, the status bar, missed-calls badge and queue monitor are visible.
 */

test.describe('Operator panel — happy path', () => {
  test('shows the start screen off shift, or the live workspace on shift', async ({ authenticatedPage: page }) => {
    await page.goto('/operator');
    const workspace = page.getByTestId(/^cc-agent-(desktop|phone)$/);
    await expect(workspace).toBeVisible();

    const start = workspace.getByTestId('agent-start-screen');
    const statusBar = workspace.getByTestId('agent-status-bar');
    await expect(start.or(statusBar).first()).toBeVisible();

    if (await start.isVisible()) {
      await expect(workspace.getByTestId('shift-login-submit')).toBeVisible();
      return;
    }

    await expect(statusBar.getByText(/Offline|Ready|In Call|Paused|Wrap-up|Готов|В вызове|Пауза/i).first()).toBeVisible();
    const missed = page.locator('button[title*="Missed"], button[title*="Пропущ"]').first();
    await expect(missed).toBeVisible();
    await missed.click();
    await expect(page.getByText(/No missed calls|Пропущенных нет/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/waiting|ожидают/i).first()).toBeVisible();
    await expect(page.getByText(/talking|разговор/i).first()).toBeVisible();
    await expect(page.getByText(/free|свободны/i).first()).toBeVisible();
  });
});
