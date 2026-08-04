import { expect, type Page } from '@playwright/test';

/** i18n-tolerant regex helpers for Call Center UI smoke tests (D-03). */
export const STATUS_REGEX = /Offline|Ready|In Call|Paused|Wrap-up|Готов|В вызове|Пауза/i;
export const MISSED_BTN = /Missed|Пропущенные/i;
export const KPI_WAITING = /waiting|ожидают/i;
export const KPI_TALKING = /talking|разговор|in call/i;
export const KPI_FREE = /free|свободны/i;

/** Assert agent workspace shell: status bar, missed badge, queue KPI labels. */
export async function assertAgentShellVisible(page: Page): Promise<void> {
  await expect(page.getByText(STATUS_REGEX).first()).toBeVisible();

  const missed = page.getByRole('button', { name: MISSED_BTN });
  await expect(missed.or(page.locator('button[title*="Missed"], button[title*="Пропущ"]'))).toBeVisible();

  await expect(page.getByText(KPI_WAITING).first()).toBeVisible();
  await expect(page.getByText(KPI_TALKING).first()).toBeVisible();
  await expect(page.getByText(KPI_FREE).first()).toBeVisible();
}

/** Assert supervisor dashboard shell: heading + queue KPI strip (no live data required). */
export async function assertSupervisorShellVisible(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: /Supervisor Dashboard|Supervisor Panel|Панель супервизора/i }),
  ).toBeVisible();

  await expect(page.getByText(KPI_WAITING).first()).toBeVisible();
  await expect(page.getByText(KPI_TALKING).first()).toBeVisible();
  await expect(page.getByText(KPI_FREE).first()).toBeVisible();
}
