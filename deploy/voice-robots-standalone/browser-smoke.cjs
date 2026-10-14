'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../artifacts/mpbx-release/frontend');
const failures = [];
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/modules/voice-robots/api.php/')) {
    res.setHeader('content-type', 'application/json');
    res.end(req.url.includes('/cdr?') ? JSON.stringify({ rows: [], count: 0 }) : req.url.includes('/cdr/stats') ? '{}' : '[]');
    return;
  }
  const relative = new URL(req.url, 'http://localhost').pathname.replace(/^\/modules\/voice-robots\//, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('content-type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(response.status() + ' ' + response.url()); });
    for (const route of ['voice-robots', 'voice-robots/create', 'voice-robots/cdr', 'settings/stt-engines', 'settings/tts-engines']) {
      await page.goto(`http://127.0.0.1:${server.address().port}/modules/voice-robots/standalone.html#/${route}`);
      await page.waitForLoadState('networkidle');
      assert.ok((await page.locator('body').innerText()).length > 30);
      console.log('rendered', route);
      if (route.startsWith('settings/')) {
        await page.getByRole('button', { name: 'Добавить движок', exact: true }).click();
        const dialog = page.getByRole('dialog'); await dialog.waitFor();
        const types = await dialog.locator('select').first().locator('option').evaluateAll(options => options.map(option => option.value));
        assert.ok(!types.includes('google'));
        if (route.endsWith('tts-engines')) assert.deepEqual(types, ['yandex']);
        console.log('engine form validated', route);
      }
    }
    await page.screenshot({ path: path.resolve(__dirname, '../../artifacts/mpbx-standalone-local.png'), fullPage: true });
    assert.deepEqual(failures, []);
    console.log('Browser/static + mocked API smoke: PASS');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
