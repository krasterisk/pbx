import { test, expect } from '../../fixtures/auth.fixture';
import { assertAgentShellVisible, MISSED_BTN } from '../../assertions/ui';

/**
 * CC agent happy path (D-03):
 *   1. Agent opens /callcenter/agent, sees the status bar.
 *   2. Queue Monitor renders KPI counters.
 *   3. The Missed Calls badge is present in the top-right corner.
 *
 * Minimum viable UI smoke before AMI-driven scenarios (requires Asterisk lab).
 */

test.describe('Agent panel — happy path', () => {
  test('renders the agent workspace with status bar and queue monitor', async ({ authenticatedPage: page }) => {
    await page.goto('/callcenter/agent');
    await assertAgentShellVisible(page);
  });

  test('clicking the missed-calls badge opens the dropdown', async ({ authenticatedPage: page }) => {
    await page.goto('/callcenter/agent');
    const missedBtn = page.getByRole('button', { name: MISSED_BTN });
    await expect(missedBtn).toBeVisible({ timeout: 20_000 });
    await missedBtn.click();
    await expect(page.getByText(/No missed calls|Пропущенных нет/i)).toBeVisible({ timeout: 5000 });
  });

  test('idle state offers Start shift when not logged in', async ({ authenticatedPage: page }) => {
    await page.goto('/callcenter/agent');
    const workspace = page.getByTestId(/^cc-agent-(desktop|phone)$/);
    await expect(workspace).toBeVisible();
    const statusBar = workspace.getByTestId('agent-status-bar');
    const startShift = statusBar.getByRole('button', { name: /^(Start shift|Начать смену)$/i });
    const activeStatus = statusBar.getByText(/Ready|In Call|Paused|Wrap-up|Готов|В вызове|Пауза/i).first();
    await expect(startShift.or(activeStatus).first()).toBeVisible();
    if (await startShift.isVisible()) await expect(startShift).toBeEnabled();
  });
});
