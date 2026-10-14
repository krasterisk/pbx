'use strict';
process.env.MPBX_TEST_RELEASE = 'mpbx-r5-frontend';
const server = require('./integration-dev-server.cjs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const failures = []; const results = [];
  try {
    const page = await browser.newPage(); page.on('pageerror', error => failures.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}/index.php?module=voice-robots`;
    for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport); await page.goto(url + '#/settings/stt-engines');
      const frame = page.frameLocator('#vpbx-voice-robots-frame');
      assert.equal(await page.locator('#vpbx-voice-robots-tabs').getByText('Инструкция для LLM').count(), 0);
      for (const [kind, label] of [['stt', 'Распознавание речи (STT)'], ['tts', 'Синтез речи (TTS)']]) {
        await page.getByRole('link', { name: label, exact: true }).click();
        await frame.getByRole('heading', { name: label, exact: true }).waitFor();
        const gutters = await frame.locator('#root').evaluate(root => {
          const card = root.querySelector('[class*="_surface_"]');
          const bounds = card.getBoundingClientRect();
          return { left: bounds.left, right: root.clientWidth - bounds.right,
            bottom: root.getBoundingClientRect().bottom - bounds.bottom };
        });
        assert.ok(gutters.left >= 24 && gutters.right >= 24 && gutters.bottom >= 40, 'Card shadows need space inside iframe');
        if (viewport.width === 1366 && kind === 'tts') await page.screenshot({ path: path.resolve(__dirname, '../../artifacts/mpbx-r5-shadow-gutters-local.png'), fullPage: true });
        await frame.getByRole('button', { name: 'Добавить движок', exact: true }).click();
        await page.waitForFunction(() => document.getElementById('vpbx-voice-robots-frame').classList.contains('vpbx-dialog-mode'));
        await page.waitForFunction(height => document.getElementById('vpbx-voice-robots-frame').contentWindow.innerHeight === height, viewport.height);
        await page.waitForFunction(() => {
          const content = document.getElementById('vpbx-voice-robots-frame').contentDocument.querySelector('[data-modal-shell][data-state="open"]');
          return content && content.getBoundingClientRect().height >= 500;
        });
        const outer = await page.locator('#vpbx-voice-robots-frame').boundingBox();
        const dialog = frame.getByRole('dialog'); const bounds = await dialog.boundingBox();
        console.log(JSON.stringify({ checking: kind, viewport, outer, bounds }));
        assert.ok(Math.abs(outer.x) < 1 && Math.abs(outer.y) < 1 && Math.abs(outer.width - viewport.width) < 1 && Math.abs(outer.height - viewport.height) < 1);
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1);
        assert.ok(bounds.height >= 500, 'Dialog must use browser viewport rather than short table iframe');
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        const footer = await dialog.getByRole('button', { name: 'Сохранить', exact: true }).boundingBox();
        assert.ok(footer.y >= 0 && footer.y + footer.height <= viewport.height);
        if (viewport.width === 1366) await page.screenshot({ path: path.resolve(__dirname, `../../artifacts/mpbx-r5-${kind}-modal-local.png`), fullPage: true });
        await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
        await page.waitForFunction(() => !document.getElementById('vpbx-voice-robots-frame').classList.contains('vpbx-dialog-mode'));
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        assert.equal(await page.locator('#vpbx-voice-robots-placeholder').isVisible(), false);
        results.push({ kind, viewport, height: bounds.height, fullscreen: true, footerVisible: true, scrollRestored: true });
      }
      await page.getByRole('link', { name: 'Ключи MCP', exact: true }).click();
      await frame.getByRole('heading', { name: 'Ключи MCP', exact: true }).waitFor();
      const mcpGutters = await frame.locator('.card').first().evaluate(card => ({ left: card.getBoundingClientRect().left,
        right: document.documentElement.clientWidth - card.getBoundingClientRect().right }));
      assert.ok(mcpGutters.left >= 24 && mcpGutters.right >= 24);
      assert.equal(await frame.locator('footer').getByRole('link', { name: /Инструкция для LLM/ }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (viewport.width === 1366) await page.screenshot({ path: path.resolve(__dirname, '../../artifacts/mpbx-r5-mcp-integrated-local.png'), fullPage: true });
    }
    assert.deepEqual(failures, []); console.log(JSON.stringify({ geometry: results, mcpFooterOnly: true, errors: 0, realCallsOrCredentials: 0 }));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
