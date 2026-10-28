'use strict';
// Run only in the user-authorized stand Chromium container, never a personal browser.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = 'http://192.168.2.201:3010';
const output = process.env.BROWSER_OUTPUT || '/exchange';
const phases = ['sse-normal', 'ws-normal', 'sse-stress', 'ws-stress'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let step = 'initialization';
const receipts = new WeakMap();

function save(file, data) {
  const target = path.join(output, file);
  fs.writeFileSync(target + '.tmp', JSON.stringify(data));
  fs.renameSync(target + '.tmp', target);
}

async function waitFile(file, seconds = 600) {
  const target = path.join(output, file);
  const deadline = Date.now() + seconds * 1000;
  while (!fs.existsSync(target)) {
    if (fs.existsSync(path.join(output, 'stop.json'))) throw Error('Operator stopped run');
    if (Date.now() > deadline) throw Error('Coordinator deadline');
    await sleep(200);
  }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

async function trace(page) {
  const receipt = receipts.get(page);
  if (!receipt) throw Error('No browser DOM receipt');
  return structuredClone(receipt);
}

async function waitTable(page, phase, index) {
  const began = Date.now();
  const deadline = began + 120000;
  while (Date.now() < deadline) {
    const receipt = receipts.get(page);
    const state = { rows: receipt?.rows.length || 0, snapshotCalls: receipt?.measurement?.snapshot?.calls ?? null,
      receiptAt: receipt?.browserAt, transport: receipt?.measurement?.transport };
    save('preparation-state.json', { at: Date.now(), phase, page: index, ...state });
    if (state.rows === 150 && state.snapshotCalls === 150 && state.receiptAt >= began
      && state.transport === (phase.startsWith('ws-') ? 'websocket' : 'sse')) return;
    await sleep(250);
  }
  throw Error('Table snapshot readiness timed out');
}

async function main() {
  if (!path.isAbsolute(output) || fs.existsSync(path.join(output, 'browser-start.json'))) throw Error('Fresh absolute output directory required');
  const access = JSON.parse(fs.readFileSync(process.env.PRIVATE_RECEIPT || '/private/cabinet-private.json', 'utf8'));
  if (access.tenant !== 5 || access.agents.length !== 200 || access.queues.length !== 12) throw Error('Owned A13 fixture required');
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const context = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const pages = [];
  // Push only our opt-in DOM measurement over Playwright's private binding.
  // No application storage, tokens, public collector route or repeated remote
  // evaluation is involved. All timings/rows originate in the actual page.
  await context.exposeBinding('__ccLoadReceipt', (source, receipt) => {
    const index = pages.indexOf(source.page);
    if (source.frame === source.page.mainFrame() && index >= 0) {
      receipts.set(source.page, receipt);
      // Retain evidence even when a freshness/consistency gate later fails.
      save('latest-page-' + index + '.json', receipt);
    }
  });
  await context.addInitScript(() => {
    if (window !== window.top || location.origin !== 'http://192.168.2.201:3010') return;
    const probes = [];
    const probe = async () => {
      const item = { at: Date.now() }; probes.push(item);
      if (probes.length > 1000) probes.shift();
      const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 5000);
      try { const response = await fetch('/api/health', { signal: abort.signal, cache: 'no-store' }); item.status = response.status; await response.text(); }
      catch (error) { item.error = error.name; }
      finally { clearTimeout(timer); item.endedAt = Date.now(); }
    };
    // Six pages =>12 reads/minute, below the observed health20/minute limit.
    setInterval(probe, 30000);
    new MutationObserver(records => {
      const output = records.find(record => record.target instanceof HTMLElement && record.target.dataset.testid === 'callcenter-benchmark-results')?.target;
      if (!output?.textContent) return;
      const measurement = JSON.parse(output.textContent);
      void window.__ccLoadReceipt({ browserAt: Date.now(), visibility: document.visibilityState,
        rows: [...document.querySelectorAll('[data-call-id][data-status]')].map(row => ({ id: row.dataset.callId, status: row.dataset.status })),
        measurement, apiProbes: probes }).catch(() => {});
    }).observe(document, { childList: true, subtree: true });
  });
  const requests = [];
  const connections = [];
  const errors = [];
  const frameTotals = Array.from({ length: 6 }, () => ({ frames: 0, bytes: 0 }));
  try {
    async function createPage(index) {
      const page = await context.newPage();
      pages.push(page);
      const pending = new Map();
      page.on('request', request => {
        const url = new URL(request.url());
        const item = { page: index, at: Date.now(), host: url.host, path: url.pathname, method: request.method(), resourceType: request.resourceType() };
        requests.push(item); pending.set(request, item);
      });
      page.on('response', response => {
        const item = pending.get(response.request());
        if (item) { item.responseAt = Date.now(); item.status = response.status(); }
      });
      page.on('requestfinished', request => { const item = pending.get(request); if (item) item.finishedAt = Date.now(); pending.delete(request); });
      page.on('requestfailed', request => {
        const item = pending.get(request);
        if (item) { item.failedAt = Date.now(); item.failure = request.failure()?.errorText?.replace(/https?:\/\/\S+/g, '[url]'); }
        pending.delete(request);
      });
      page.on('pageerror', error => errors.push({ page: index, at: Date.now(), kind: 'pageerror', name: error.name }));
      page.on('console', message => { if (message.type() === 'error') errors.push({ page: index, at: Date.now(), kind: 'console-error' }); });
      page.on('websocket', socket => {
        const item = { page: index, openedAt: Date.now(), path: new URL(socket.url()).pathname };
        connections.push(item);
        socket.on('close', () => { item.closedAt = Date.now(); });
        socket.on('framereceived', frame => {
          frameTotals[index].frames++; frameTotals[index].bytes += Buffer.byteLength(frame.payload);
          if (frame.payload === '2') item.lastPingAt = Date.now();
          if (typeof frame.payload === 'string' && frame.payload.startsWith('42/callcenter-events,')) {
            try {
              const event = JSON.parse(frame.payload.slice(frame.payload.indexOf('[')))[1];
              if (event?.type === 'fullSnapshot') {
                const data = JSON.parse(event.data);
                (item.snapshots ||= []).push({ at: Date.now(), agents: data.agents?.length, calls: data.calls?.length, queues: data.queues?.length });
              }
            } catch { /* Count-only diagnostics must not affect the application. */ }
          }
        });
        socket.on('framesent', frame => { if (frame.payload === '3') item.lastPongAt = Date.now(); });
        socket.on('socketerror', () => { item.socketErrorAt = Date.now(); });
      });
    }
    for (let index = 0; index < 6; index++) await createPage(index);
    step = 'login';
    await pages[0].goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pages[0].getByLabel('Логин', { exact: true }).fill(access.supervisor.login);
    await pages[0].getByLabel('Пароль', { exact: true }).fill(access.supervisor.password);
    await pages[0].getByRole('button', { name: 'Войти', exact: true }).click();
    await pages[0].locator('#user-block-trigger').waitFor({ timeout: 60000 });
    save('browser-start.json', { at: Date.now(), version: browser.version(), channel: 'chromium', pages: 6, origin: base, viewport: { width: 1440, height: 1000 }, headless: true, tenant: access.tenant });
    for (const phase of phases) {
      step = 'prepare-' + phase;
      await waitFile('prepare-' + phase + '.json');
      const transport = phase.startsWith('ws-') ? 'websocket' : 'sse';
      // Close owned targets without beforeunload: HTTP navigation needs a free
      // slot with SSE, and even a blank-document commit can wait behind an
      // overloaded renderer. Keep the authenticated context; measure six fresh
      // pages for every candidate, with identical cache and preparation policy.
      await Promise.all(pages.map(page => page.close({ runBeforeUnload: false })));
      pages.length = 0;
      for (let index = 0; index < 6; index++) await createPage(index);
      // Prepare pages sequentially: concurrent cold loads of the same large
      // module hit Chromium ERR_CACHE_WRITE_FAILURE in the isolated profile.
      // This is outside the measured window; all six stay open during load.
      const results = [];
      for (const [index, page] of pages.entries()) {
        const before = Date.now();
        let readinessStep = 'navigation';
        save('preparation-state.json', { at: Date.now(), phase, page: index, readinessStep });
        try {
          receipts.delete(page);
          await page.goto(base + '/callcenter/supervisor?view=calls&sort=name&ccTransport=' + transport, { waitUntil: 'domcontentloaded', timeout: 60000 });
          readinessStep = 'table-and-snapshot';
          save('preparation-state.json', { at: Date.now(), phase, page: index, readinessStep });
          await waitTable(page, phase, index);
          results.push({ page: index, ready: true, readyMs: Date.now() - before, trace: await trace(page) });
          save('progress-' + phase + '.json', { at: Date.now(), pages: results.map(item => ({ page: item.page, ready: item.ready, readyMs: item.readyMs })) });
          console.info(JSON.stringify({ phase, page: index, readyMs: Date.now() - before }));
        } catch (error) {
          const diagnostic = await trace(page).catch(() => null);
          const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => 'unavailable');
          await page.screenshot({ path: path.join(output, phase + '-failure-page-' + index + '.png'), timeout: 10000 }).catch(() => {});
          results.push({ page: index, ready: false, error: error.name, readinessStep, elapsedMs: Date.now() - before, trace: diagnostic, url: page.url(), text: text.slice(0, 4000) });
          break;
        }
      }
      save('ready-' + phase + '.json', { at: Date.now(), transport, pages: results });
      step = 'warmup-' + phase;
      await waitFile('start-' + phase + '.json');
      const start = Date.now();
      const initial = await Promise.all(pages.map(trace));
      const framesBefore = structuredClone(frameTotals);
      save('started-' + phase + '.json', { at: start, initial, framesBefore });
      step = 'measure-' + phase;
      await waitFile('end-' + phase + '.json');
      const end = Date.now();
      const freshDeadline = end + 25000;
      while (pages.some(page => (receipts.get(page)?.browserAt || 0) < end) && Date.now() < freshDeadline) await sleep(250);
      const final = await Promise.all(pages.map(trace));
      const fresh = final.every(item => item.browserAt >= end);
      const apiProbes = final.map(item => item.apiProbes);
      save('result-' + phase + '.json', {
        phase, start, end, fresh, initial, final, apiProbes, framesBefore, framesAfter: frameTotals,
        requests: requests.filter(item => item.at >= start && item.at <= end),
        failuresCompletedInWindow: requests.filter(item => item.failedAt >= start && item.failedAt <= end),
        connectionEvents: connections.filter(item => item.openedAt <= end && (!item.closedAt || item.closedAt >= start)),
        eventStreams: requests.filter(item => item.path === '/api/callcenter/events' && item.at <= end && (!item.finishedAt || item.finishedAt >= start) && (!item.failedAt || item.failedAt >= start)),
        errors: errors.filter(item => item.at >= start && item.at <= end),
      });
      await pages[5].screenshot({ path: path.join(output, phase + '.png'), fullPage: false, timeout: 15000 }).catch(() => {});
      save('done-' + phase + '.json', { at: Date.now(), phase, fresh, pages: final.map(item => ({ rows: item.rows.length, talking: item.rows.filter(row => row.status === 'TALKING').length, transport: item.measurement?.transport, observerErrors: item.measurement?.observerErrors })) });
    }
    save('browser-finished.json', { at: Date.now(), pages: 6 });
  } finally {
    save('latest-dom-receipts.json', { at: Date.now(), step, pages: pages.map((page, index) => ({ page: index, receipt: receipts.get(page) || null })) });
    save('network-all.json', { at: Date.now(), step, requests, connections, errors, frameTotals });
    await context.close();
    await browser.close();
  }
}

main().catch(error => {
  save('browser-failure.json', { at: Date.now(), step, name: error.name });
  console.error(JSON.stringify({ failed: true, step, name: error.name }));
  process.exitCode = 1;
});
