import { test, expect } from '../../fixtures/auth.fixture';
import { assertSupervisorShellVisible } from '../../assertions/ui';
import { closeAssistantIfOpen } from '../../helpers/ui-cleanup';

/**
 * CC supervisor happy path (D-03):
 *   1. Supervisor opens /callcenter/supervisor, sees dashboard heading.
 *   2. Queue monitor KPI strip renders (counts may be 0).
 *   3. Page loads without error boundary — no live queue data required.
 *
 * Requires a tenant ADMIN/SUPERVISOR session (ci-tenant-a). Platform admin
 * (level 0) is redirected by RequireRole.
 */

test.describe('Supervisor panel — happy path', () => {
  test('renders the supervisor dashboard with KPI strip', async ({ authenticatedPage: page }) => {
    await page.goto('/callcenter/supervisor');
    await closeAssistantIfOpen(page);
    await assertSupervisorShellVisible(page);
  });

  test('opens live calls from the waiting KPI and returns to the agent board', async ({ authenticatedPage: page }) => {
    await page.goto('/callcenter/supervisor');
    await closeAssistantIfOpen(page);
    await expect(page.getByTestId('supervisor-agents-board')).toBeVisible();
    await expect(page.getByTestId('supervisor-calls-panel')).toHaveCount(0);
    await page.getByTestId('supervisor-metric-waiting').click();
    await expect(page.getByTestId('supervisor-calls-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('supervisor-calls-panel')).toHaveCount(0);
    await expect(page.getByTestId('supervisor-agents-board')).toBeVisible();
  });

  test('loads without a connection error banner', async ({ authenticatedPage: page }) => {
    await page.goto('/callcenter/supervisor');
    await closeAssistantIfOpen(page);
    await expect(page.getByTestId('cc-supervisor-responsive')).toBeVisible();
    await expect(page.getByTestId('cc-connection-banner')).toHaveCount(0);
  });
});
