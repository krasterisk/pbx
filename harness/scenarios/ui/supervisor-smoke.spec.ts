import { test, expect } from '../../fixtures/auth.fixture';
import { assertSupervisorShellVisible } from '../../assertions/ui';

/**
 * CC supervisor happy path (D-03):
 *   1. Supervisor opens /callcenter/supervisor, sees dashboard heading.
 *   2. Queue monitor KPI strip renders (counts may be 0).
 *   3. Page loads without error boundary — no live queue data required.
 */

test.describe('Supervisor panel — happy path', () => {
  test('renders the supervisor dashboard with KPI strip', async ({ authenticatedPage: page }) => {
    await page.goto('/callcenter/supervisor');
    await assertSupervisorShellVisible(page);
  });

  test('shows agent tab navigation', async ({ authenticatedPage: page }) => {
    await page.goto('/callcenter/supervisor');
    await expect(page.getByRole('button', { name: /Agents|Агенты/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Live Calls|Активные/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Queues|Очереди/i }).first()).toBeVisible();
  });

  test('SSE connection indicator is present', async ({ authenticatedPage: page }) => {
    await page.goto('/callcenter/supervisor');
    await expect(page.getByText(/Live|Connecting/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
