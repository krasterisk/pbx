import { test, expect } from '../fixtures/auth.fixture';

/**
 * CC-1e happy path:
 *   1. Operator opens the workspace, sees the status bar.
 *   2. Before a shift, the status bar offers Start shift; during a shift it shows the agent state.
 *   3. Queue Monitor renders KPI counters and the heading row.
 *   4. The Missed Calls badge is present in the top-right corner.
 *
 * This is the minimum viable smoke test we want green in CI before
 * we layer real AMI-driven scenarios (which need an Asterisk fixture).
 */

test.describe('Operator panel — happy path', () => {
  test('renders the operator workspace with status bar and queue monitor', async ({ authenticatedPage: page }) => {
    await page.goto('/operator');
    const workspace = page.getByTestId(/^cc-agent-(desktop|phone)$/);
    await expect(workspace).toBeVisible();

    // Status bar is visible (looking for either Russian or English label)
    const status = workspace.getByTestId('agent-status-bar').getByText(/Offline|Ready|In Call|Paused|Wrap-up|Готов|В вызове|Пауза/i).first();
    await expect(status).toBeVisible();

    // Missed calls badge (rendered next to the connection indicator)
    const missed = page.getByRole('button', { name: /Missed|Пропущенные/i });
    await expect(missed.or(page.locator('button[title*="Missed"], button[title*="Пропущ"]'))).toBeVisible();

    // Queue Monitor KPIs (counts may be 0 — we just verify the labels)
    await expect(page.getByText(/waiting|ожидают/i).first()).toBeVisible();
    await expect(page.getByText(/talking|разговор/i).first()).toBeVisible();
    await expect(page.getByText(/free|свободны/i).first()).toBeVisible();
  });

  test('clicking the missed-calls badge opens the dropdown', async ({ authenticatedPage: page }) => {
    await page.goto('/operator');
    const missedBtn = page.locator('button[title*="Missed"], button[title*="Пропущ"]').first();
    await missedBtn.click();
    await expect(page.getByText(/No missed calls|Пропущенных нет/i)).toBeVisible({ timeout: 5000 });
  });

  test('idle state offers Start shift when not logged in', async ({ authenticatedPage: page }) => {
    await page.goto('/operator');
    const workspace = page.getByTestId(/^cc-agent-(desktop|phone)$/);
    await expect(workspace).toBeVisible();
    const statusBar = workspace.getByTestId('agent-status-bar');
    const startShift = statusBar.getByRole('button', { name: /^(Start shift|Начать смену)$/i });
    const activeStatus = statusBar.getByText(/Ready|In Call|Paused|Wrap-up|Готов|В вызове|Пауза/i).first();
    await expect(startShift.or(activeStatus).first()).toBeVisible();
    if (await startShift.isVisible()) await expect(startShift).toBeEnabled();
  });
});
