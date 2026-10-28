'use strict';
// Run only in the user-authorized stand Chromium container, never a personal browser.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = 'http://192.168.2.201:3010';
const output = process.env.BROWSER_OUTPUT || '/exchange';
const phases = ['ws-normal', 'sse-normal', 'ws-stress', 'sse-stress'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let step = 'initialization';

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
  return page.evaluate(() => {
    const element = document.querySelector('[data-testid="callcenter-benchmark-results"]');
    const measurement = element?.textContent ? JSON.parse(element.textContent) : null;
    return {
      browserAt: Date.now(), visibility: document.visibilityState,
      rows: [...document.querySelectorAll('[data-call-id][data-status]')].map(row => ({ id: row.dataset.callId, status: row.dataset.status })),
      measurement,
    };
  });
}

async function main() {
  if (!path.isAbsolute(output) || fs.existsSync(path.join(output, 'browser-start.json'))) throw Error('Fresh absolute output directory required');
  const access = JSON.parse(fs.readFileSync(process.env.PRIVATE_RECEIPT || '/private/cabinet-private.json', 'utf8'));
  if (access.tenant !== 5 || access.agents.length !== 200 || access.queues.length !== 12) throw Error('Owned A13 fixture required');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const pages = [];
  const requests = [];
  const connections = [];
  const errors = [];
  const frameTotals = Array.from({ length: 6 }, () => ({ frames: 0, bytes: 0 }));
  try {
    for (let index = 0; index < 6; index++) {
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
    step = 'login';
    await pages[0].goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pages[0].getByLabel('Логин', { exact: true }).fill(access.supervisor.login);
    await pages[0].getByLabel('Пароль', { exact: true }).fill(access.supervisor.password);
    await pages[0].getByRole('button', { name: 'Войти', exact: true }).click();
    await pages[0].locator('#user-block-trigger').waitFor({ timeout: 60000 });
    save('browser-start.json', { at: Date.now(), version: browser.version(), pages: 6, origin: base, viewport: { width: 1440, height: 1000 }, headless: true, tenant: access.tenant });
    for (const phase of phases) {
      step = 'prepare-' + phase;
      await waitFile('prepare-' + phase + '.json');
      const transport = phase.startsWith('ws-') ? 'websocket' : 'sse';
      // Prepare pages sequentially: concurrent cold loads of the same large
      // module hit Chromium ERR_CACHE_WRITE_FAILURE in the isolated profile.
      // This is outside the measured window; all six stay open during load.
      const results = [];
      for (const [index, page] of pages.entries()) {
        const before = Date.now();
        let readinessStep = 'navigation';
        try {
          await page.goto(base + '/callcenter/supervisor?view=calls&sort=name&ccTransport=' + transport, { waitUntil: 'domcontentloaded', timeout: 60000 });
          readinessStep = 'rows';
          await page.waitForFunction(() => document.querySelectorAll('[data-call-id][data-status]').length === 150, undefined, { timeout: 90000 });
          readinessStep = 'snapshot-receipt';
          await page.waitForFunction(() => {
            const element = document.querySelector('[data-testid="callcenter-benchmark-results"]');
            return element?.textContent && JSON.parse(element.textContent).snapshot?.calls === 150;
          }, undefined, { timeout: 30000 });
          results.push({ page: index, ready: true, readyMs: Date.now() - before, trace: await trace(page) });
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
      const final = await Promise.all(pages.map(trace));
      save('result-' + phase + '.json', {
        phase, start, end, initial, final, framesBefore, framesAfter: frameTotals,
        requests: requests.filter(item => item.at >= start && item.at <= end),
        failuresCompletedInWindow: requests.filter(item => item.failedAt >= start && item.failedAt <= end),
        connectionEvents: connections.filter(item => item.openedAt <= end && (!item.closedAt || item.closedAt >= start)),
        eventStreams: requests.filter(item => item.path === '/api/callcenter/events' && item.at <= end && (!item.finishedAt || item.finishedAt >= start) && (!item.failedAt || item.failedAt >= start)),
        errors: errors.filter(item => item.at >= start && item.at <= end),
      });
      await pages[5].screenshot({ path: path.join(output, phase + '.png'), fullPage: false, timeout: 15000 }).catch(() => {});
      save('done-' + phase + '.json', { at: Date.now(), phase, pages: final.map(item => ({ rows: item.rows.length, talking: item.rows.filter(row => row.status === 'TALKING').length, transport: item.measurement?.transport, observerErrors: item.measurement?.observerErrors })) });
    }
    save('browser-finished.json', { at: Date.now(), pages: 6 });
  } finally {
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
