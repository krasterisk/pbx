const { chromium } = require('playwright');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'navigation-browser-fixture');
      localStorage.setItem('user', JSON.stringify({ uid: 1, name: 'Navigation test', level: 1, vpbx_user_uid: 1 }));
      localStorage.setItem('i18nextLng', 'ru');
      localStorage.setItem('theme', 'dark');
    });
    await page.route('**/api/**', (route) => {
      if (!new URL(route.request().url()).pathname.startsWith('/api/')) return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().url().includes('settings') ? {} : []) });
    });
    await page.route('**/socket.io/**', (route) => route.abort());
    await page.goto('http://127.0.0.1:3017/moh', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('phone-module-menu-trigger').click();
    await page.getByTestId('phone-module-menu').waitFor();
    await page.screenshot({ path: path.join(__dirname, 'mobile-menu-390.png'), fullPage: true });
    console.log('Menu visual captured, catalog rows:', await page.locator('[data-testid="phone-module-menu"] button').count());
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
