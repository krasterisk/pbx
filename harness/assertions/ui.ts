import { expect, type Page } from '@playwright/test';

/** i18n-tolerant regex helpers for Call Center UI smoke tests (D-03). */
export const STATUS_REGEX = /Offline|Ready|In Call|Paused|Wrap-up|Готов|В вызове|Пауза/i;
export const MISSED_BTN = /Missed|Пропущенные/i;
export const KPI_WAITING = /waiting|ожидают/i;
export const KPI_TALKING = /talking|разговор|in call/i;
export const KPI_FREE = /free|свободны/i;

/** Assert agent workspace: start screen off shift, or status bar and queue labels on shift. */
export async function assertAgentShellVisible(page: Page): Promise<void> {
  const workspace = page.getByTestId(/^cc-agent-(desktop|phone)$/);
  await expect(workspace).toBeVisible();
  const start = workspace.getByTestId('agent-start-screen');
  const statusBar = workspace.getByTestId('agent-status-bar');
  await expect(start.or(statusBar).first()).toBeVisible();
  if (await start.isVisible()) {
    await expect(workspace.getByTestId('shift-login-submit')).toBeVisible();
    return;
  }
  await expect(statusBar.getByText(STATUS_REGEX).first()).toBeVisible();

  const missed = page.getByRole('button', { name: MISSED_BTN });
  await expect(missed.or(page.locator('button[title*="Missed"], button[title*="Пропущ"]'))).toBeVisible();

  await expect(page.getByText(KPI_WAITING).first()).toBeVisible();
  await expect(page.getByText(KPI_TALKING).first()).toBeVisible();
  await expect(page.getByText(KPI_FREE).first()).toBeVisible();
}

/** Assert supervisor dashboard shell: board is visible. Counts may be zero. */
export async function assertSupervisorShellVisible(page: Page): Promise<void> {
  const root = page.getByTestId('cc-supervisor-responsive');
  await expect(root).toBeVisible();
  await expect(root.getByTestId('supervisor-agents-board')).toBeVisible();
  await expect(root.getByTestId('cc-supervisor-kpi-sticky')).toBeVisible();
  for (const metric of ['sla', 'answered', 'abandoned', 'waiting']) {
    await expect(root.getByTestId(`supervisor-metric-${metric}`)).toBeVisible();
  }
}
