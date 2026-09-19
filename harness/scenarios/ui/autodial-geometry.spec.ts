import { test, expect } from '../../fixtures/auth.fixture';

const VIEWPORTS = [360, 390, 768, 1280, 1920, 2560];
const PAGES = [
  {
    path: '/autodial',
    root: 'autodial-campaigns-page-responsive',
    modal: 'autodial-campaign-form-modal',
  },
  {
    path: '/autodial/bases',
    root: 'autodial-bases-page-responsive',
    modal: 'autodial-base-form-modal',
  },
] as const;

for (const lang of ['ru', 'en'] as const) {
  for (const width of VIEWPORTS) {
    test(`autodial layout ${lang} ${width}px`, async ({ authenticatedPage: page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((language) => localStorage.setItem('i18nextLng', language), lang);

      for (const screen of PAGES) {
        await page.goto(screen.path);
        const root = page.getByTestId(screen.root);
        await expect(root).toBeVisible();
        await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(width + 1);

        await root.locator('button').first().click();
        const modal = page.getByTestId(screen.modal);
        await expect(modal).toBeVisible();
        const bounds = await modal.boundingBox();
        expect(bounds, `${screen.path} modal bounds`).not.toBeNull();
        expect(bounds!.x, `${screen.path} modal left`).toBeGreaterThanOrEqual(-1);
        expect(bounds!.x + bounds!.width, `${screen.path} modal right`)
          .toBeLessThanOrEqual(width + 1);
        await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(width + 1);
      }
    });
  }

  test(`campaign tabs at effective 360px viewport ${lang}`, async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.addInitScript((language) => localStorage.setItem('i18nextLng', language), lang);
    await page.goto('/autodial');
    const root = page.getByTestId('autodial-campaigns-page-responsive');
    await expect(root).toBeVisible();
    await root.locator('button').first().click();
    const modal = page.getByTestId('autodial-campaign-form-modal');
    await expect(modal).toBeVisible();

    const tabs = modal.getByRole('tab');
    await expect(tabs).toHaveCount(7);
    for (let index = 0; index < 7; index += 1) {
      await tabs.nth(index).click();
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(overflow.scrollWidth, `tab ${index} page overflow`)
        .toBeLessThanOrEqual(overflow.viewportWidth + 1);
      const bounds = await modal.boundingBox();
      expect(bounds, `tab ${index} modal bounds`).not.toBeNull();
      expect(bounds!.x, `tab ${index} modal left`).toBeGreaterThanOrEqual(-1);
      expect(bounds!.x + bounds!.width, `tab ${index} modal right`)
        .toBeLessThanOrEqual(360 + 1);
    }
  });
}
