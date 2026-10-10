const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const evidence = path.resolve(__dirname);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    localStorage.setItem('accessToken', 'navigation-browser-fixture');
    localStorage.setItem('user', JSON.stringify({ uid: 1, name: 'Navigation test', login: 'nav-test', level: 1, vpbx_user_uid: 1 }));
    localStorage.setItem('i18nextLng', 'ru');
    localStorage.setItem('theme', 'dark');
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('PAGE_ERROR', String(error)));
  page.on('console', (message) => { if (message.type() === 'error') console.error('CONSOLE_ERROR', message.text()); });
  page.on('requestfailed', (request) => console.error('REQUEST_FAILED', request.url(), request.failure()?.errorText));
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    if (!new URL(url).pathname.startsWith('/api/')) return route.continue();
    const data = url.includes('role-start') ? { path: '/modules' }
      : url.includes('hub-catalog') ? []
      : url.includes('settings') ? {}
      : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.route('**/socket.io/**', (route) => route.abort());
  const report = { kind: 'local-browser-with-mocked-api', checks: [] };
  try {
    await page.goto('http://127.0.0.1:3017/moh', { waitUntil: 'domcontentloaded' });
    console.log('APP_URL', page.url());
    await page.getByTestId('phone-module-menu-trigger').waitFor({ timeout: 60000 });
    await page.getByTestId('bottom-bar-page-moh').waitFor();
    for (const width of [360, 390, 640, 767]) {
      await page.setViewportSize({ width, height: 844 });
      const dims = await page.evaluate(() => {
        const bar = document.querySelector('[data-testid="mobile-bottom-bar"]');
        const pages = document.querySelector('[data-testid="bottom-bar-pages"]');
        const menu = document.querySelector('[data-testid="phone-module-menu-trigger"]');
        const rect = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, bar: rect(bar), pages: rect(pages), pagesScrollWidth: pages.scrollWidth, menu: rect(menu), pageCount: pages.querySelectorAll('button').length };
      });
      assert.ok(dims.scrollWidth <= width, `page overflow at ${width}: ${dims.scrollWidth}`);
      assert.equal(dims.bar.bottom, 844);
      assert.equal(dims.bar.height, 60);
      assert.ok(dims.menu.left < 24 && dims.menu.top < 12);
      assert.ok(dims.pageCount >= 8);
      report.checks.push({ name: `mobile-layout-${width}`, result: 'pass', ...dims });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('phone-module-menu-trigger').click();
    await page.getByTestId('phone-module-menu').waitFor();
    const menu = page.getByTestId('phone-module-menu');
    assert.equal(await menu.getAttribute('data-side'), 'left');
    assert.equal(await menu.getByRole('textbox').count(), 0);
    assert.equal(await menu.locator('nav button').last().getAttribute('data-testid'), 'phone-module-hub');
    const menuBounds = await menu.boundingBox();
    assert.equal(menuBounds.x, 0);
    assert.equal(menuBounds.y, 0);
    assert.equal(menuBounds.height, 844);
    assert.ok(menuBounds.width <= 320);
    await page.screenshot({ path: path.join(evidence, 'mobile-menu-390.png'), fullPage: true });
    report.checks.push({ name: 'left-sheet-menu-without-search', result: 'pass', bounds: menuBounds });
    await page.getByTestId('phone-module-core').click();
    await page.getByTestId('bottom-bar-section').waitFor();
    await page.waitForURL('**/endpoints');
    assert.equal(await page.getByTestId('bottom-bar-section').innerText(), 'PBX');
    assert.equal(await page.getByTestId('phone-module-menu').count(), 0);
    report.checks.push({ name: 'hamburger-section-switch', result: 'pass' });
    const pages = page.getByTestId('bottom-bar-pages');
    await pages.evaluate((node) => { node.scrollLeft = 0; });
    const before = await pages.evaluate((node) => node.scrollLeft);
    const bounds = await pages.boundingBox();
    const cdp = await context.newCDPSession(page);
    const xStart = bounds.x + bounds.width - 24;
    const y = bounds.y + bounds.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: xStart, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: xStart - 18 * i, y }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction((initial) => document.querySelector('[data-testid="bottom-bar-pages"]').scrollLeft > initial + 20, before);
    const after = await pages.evaluate((node) => node.scrollLeft);
    report.checks.push({ name: 'touch-swipe-scroll', result: 'pass', before, after });
    await page.getByTestId('bottom-bar-page-trunks').click();
    await page.waitForURL('**/trunks');
    assert.equal(await page.getByTestId('bottom-bar-page-trunks').getAttribute('aria-current'), 'page');
    report.checks.push({ name: 'direct-page-navigation', result: 'pass' });
    await page.screenshot({ path: path.join(evidence, 'mobile-390.png'), fullPage: true });
    const mouseContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: await context.storageState(),
    });
    const mousePage = await mouseContext.newPage();
    await mousePage.route('**/api/**', (route) => {
      const url = route.request().url();
      if (!new URL(url).pathname.startsWith('/api/')) return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(url.includes('settings') ? {} : []) });
    });
    await mousePage.route('**/socket.io/**', (route) => route.abort());
    await mousePage.goto('http://127.0.0.1:3017/moh', { waitUntil: 'domcontentloaded' });
    const mouseStrip = mousePage.getByTestId('bottom-bar-pages');
    await mouseStrip.waitFor();
    await mouseStrip.evaluate((node) => { node.scrollLeft = 0; });
    const mouseBounds = await mouseStrip.boundingBox();
    const mouseBefore = await mouseStrip.evaluate((node) => node.scrollLeft);
    assert.equal(await mouseStrip.evaluate((node) => getComputedStyle(node).scrollbarWidth), 'thin');
    for (let attempt = 0; attempt < 4; attempt++) {
      const y = mouseBounds.y + mouseBounds.height / 2;
      await mousePage.mouse.move(mouseBounds.x + mouseBounds.width - 12, y);
      await mousePage.mouse.down();
      await mousePage.mouse.move(mouseBounds.x + 12, y, { steps: 12 });
      await mousePage.mouse.up();
      assert.ok(mousePage.url().endsWith('/moh'), 'mouse release must not navigate');
    }
    const mouseAfter = await mouseStrip.evaluate((node) => node.scrollLeft);
    const lastItem = mousePage.getByTestId('bottom-bar-page-integrations');
    const lastBounds = await lastItem.boundingBox();
    assert.ok(mouseAfter > mouseBefore + 100);
    assert.ok(lastBounds.x >= mouseBounds.x - 1);
    assert.ok(lastBounds.x + lastBounds.width <= mouseBounds.x + mouseBounds.width + 1);
    await mousePage.screenshot({ path: path.join(evidence, 'mobile-mouse-last-390.png'), fullPage: true });
    await lastItem.click();
    await mousePage.waitForURL('**/integrations');
    report.checks.push({ name: 'mouse-drag-to-last-page-and-click', result: 'pass', before: mouseBefore, after: mouseAfter });
    await mouseContext.close();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId('module-shell-sidebar').waitFor();
    assert.equal(await page.getByTestId('phone-module-menu-trigger').count(), 0);
    assert.equal(await page.getByTestId('mobile-bottom-bar').count(), 0);
    await page.getByTestId('crumb-module').waitFor();
    report.checks.push({ name: 'desktop-sidebar-and-breadcrumbs', result: 'pass' });
    await page.screenshot({ path: path.join(evidence, 'desktop-1280.png'), fullPage: true });
  } catch (error) {
    report.error = String(error);
    await page.screenshot({ path: path.join(evidence, 'browser-failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await fs.writeFile(path.join(evidence, 'browser-report.json'), JSON.stringify(report, null, 2));
    await browser.close();
    console.log(JSON.stringify(report));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
