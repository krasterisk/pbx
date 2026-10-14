'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
async function main() {
  let keys = [];
  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/modules/voice-robots/api.php/')) {
      res.setHeader('Content-Type', 'application/json');
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      if (req.method === 'POST') { const input = JSON.parse(Buffer.concat(chunks)); assert.equal(input.scope, 'configure');
        const key = { id: 'local-test', name: input.name, scope: input.scope, expiresAt: '2026-10-20T00:00:00Z' }; keys.push(key);
        res.statusCode = 201; res.end(JSON.stringify({ ...key, token: 'krvr_' + 'a'.repeat(43) })); }
      else if (req.method === 'DELETE') { keys = []; res.end('{"revoked":true}'); }
      else res.end(JSON.stringify({ credentials: keys }));
      return;
    }
    for (const file of ['integration-child.js', 'mcp-access.js', 'mcp-access.css']) {
      if (req.url.startsWith('/modules/voice-robots/' + file)) {
        res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'application/javascript'); res.end(fs.readFileSync(path.join(__dirname, 'public', file))); return;
      }
    }
    res.setHeader('Content-Type', 'text/html'); res.end(fs.readFileSync(path.join(__dirname, 'public/mcp-access.html')));
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}/mcp-access.html`);
    await page.locator('#name').fill('<b>LLM test</b>'); await page.locator('#scope').selectOption('configure');
    await page.getByRole('button', { name: 'Создать ключ' }).click();
    await page.waitForFunction(() => !document.getElementById('secret').hidden && document.querySelector('td'));
    assert.equal(await page.locator('#token').inputValue(), 'krvr_' + 'a'.repeat(43));
    assert.equal(await page.locator('td b').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('footer a').getAttribute('href'), 'AGENTS.md');
    await page.screenshot({ path: path.resolve(__dirname, '../../artifacts/mpbx-r5-mcp-access-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Отозвать' }).click();
    await page.getByRole('button', { name: 'Отозвать ключ', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('secret').hidden && !document.querySelector('td'));
    assert.equal(await page.locator('#token').inputValue(), '');
    console.log('MCP credential page: create/configure scope/one-time display/text escaping/revoke/mobile width PASS (mock API; fake key)');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
