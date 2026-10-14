'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, 'public', name), 'utf8');
function child() {
  const listeners = {}; const parent = { postMessage() {} };
  const window = { parent, addEventListener(name, fn) { listeners[name] = fn; }, dispatchEvent() {} };
  const location = { origin: 'https://mpbx.krasterisk.ru', search: '?embedded=1', hash: '#/voice-robots' };
  const document = { documentElement: { classList: { add() {} } }, readyState: 'loading', addEventListener() {} };
  vm.runInNewContext(read('integration-child.js'), { window, parent, location, document, URLSearchParams, CustomEvent: class {}, requestAnimationFrame() {}, ResizeObserver: class {} });
  return { window, parent, location, message: listeners.message };
}
test('child accepts safe host context only from its own origin and direct parent', () => {
  const c = child();
  const data = { type: 'vpbx:context', context: { module: 'voice-robots', tenantUid: 42, userName: 'Admin', roleLevel: 1, locale: 'ru', api_key: 'discard' } };
  c.message({ origin: 'https://evil.invalid', source: c.parent, data }); assert.equal(c.window.VpbxVoiceRobotsContext, undefined);
  c.message({ origin: c.location.origin, source: {}, data }); assert.equal(c.window.VpbxVoiceRobotsContext, undefined);
  c.message({ origin: c.location.origin, source: c.parent, data });
  assert.equal(c.window.VpbxVoiceRobotsContext.tenantUid, 42);
  assert.equal(c.window.VpbxVoiceRobotsContext.api_key, undefined);
  assert.equal(Object.isFrozen(c.window.VpbxVoiceRobotsContext), true);
});
test('child rejects arbitrary navigation and foreign sender', () => {
  const c = child();
  for (const route of ['https://evil.invalid/', '/auth/refresh', '/voice-robots/../../users']) c.message({ origin: c.location.origin, source: c.parent, data: { type: 'vpbx:navigate', route } });
  assert.equal(c.location.hash, '#/voice-robots');
  c.message({ origin: c.location.origin, source: c.parent, data: { type: 'vpbx:navigate', route: '/voice-robots/create' } });
  assert.equal(c.location.hash, '/voice-robots/create');
});
function host(hash) {
  const handlers = {}; const classes = new Set();
  const frame = { contentWindow: { postMessage() {} }, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ height: 360 }),
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) } };
  const placeholder = { hidden: true, style: {} }; const body = { style: { overflow: 'auto' } };
  const location = { origin: 'https://mpbx.krasterisk.ru', hash };
  const document = { body, getElementById(id) { return id.endsWith('frame') ? frame : id.endsWith('placeholder') ? placeholder : { textContent: '{"module":"voice-robots","tenantUid":42}' }; }, querySelectorAll() { return []; } };
  const window = { scrollX: 0, scrollY: 120, scrollTo(x,y) { window.restored = [x,y]; }, addEventListener(name, fn) { handlers[name] = fn; } };
  vm.runInNewContext(read('integration-host.js'), { document, location, window });
  return { frame, location, handlers, classes, placeholder, body, window };
}
test('deep links initialize the correct iframe before the first child render', () => {
  const h = host('#/voice-robots/create');
  assert.equal(h.frame.src, '/modules/voice-robots/standalone.html?embedded=1&ui=6#/voice-robots/create');
  h.location.hash = '#/mcp-access'; h.handlers.hashchange();
  assert.equal(h.frame.src, '/modules/voice-robots/mcp-access.html?embedded=1&ui=6');
});
test('parent trusts only its iframe, clamps height and rejects arbitrary routes', () => {
  const h = host('#/voice-robots'); const valid = { origin: h.location.origin, source: h.frame.contentWindow };
  h.handlers.message({ ...valid, source: {}, data: { type: 'vpbx:height', height: 600 } }); assert.equal(h.frame.style.height, undefined);
  h.handlers.message({ ...valid, data: { type: 'vpbx:height', height: 100000 } }); assert.equal(h.frame.style.height, '30000px');
  h.handlers.message({ ...valid, data: { type: 'vpbx:route', route: '//evil.invalid/' } }); assert.equal(h.location.hash, '#/voice-robots');
  h.handlers.message({ ...valid, data: { type: 'vpbx:route', route: '/voice-robots/37' } }); assert.equal(h.location.hash, '/voice-robots/37');
});
test('actual PHP fixture escapes HTML/script names and exposes only display context', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../artifacts/mpbx-r4-integration-fixture.html'), 'utf8');
  assert.ok(!html.includes('</script><script>window.fixtureInjection=true</script>'));
  const context = JSON.parse(html.match(/id="vpbx-voice-robots-context">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(Object.keys(context).sort(), ['locale', 'module', 'roleLevel', 'tenantName', 'tenantUid', 'userName']);
  assert.equal(context.tenantUid, 42);
});

test('dialog promotion is sender-bound, preserves layout and restores original body scroll', () => {
  const h = host('#/settings/stt-engines'); const valid = { origin: h.location.origin, source: h.frame.contentWindow };
  h.handlers.message({ ...valid, source: {}, data: { type: 'vpbx:dialog', open: true } }); assert.equal(h.classes.size, 0);
  h.handlers.message({ ...valid, data: { type: 'vpbx:dialog', open: 'true' } }); assert.equal(h.classes.size, 0);
  h.handlers.message({ ...valid, data: { type: 'vpbx:dialog', open: true } });
  assert.ok(h.classes.has('vpbx-dialog-mode')); assert.equal(h.placeholder.style.height, '360px'); assert.equal(h.placeholder.hidden, false); assert.equal(h.body.style.overflow, 'hidden');
  h.handlers.message({ ...valid, data: { type: 'vpbx:height', height: 1000 } }); assert.equal(h.frame.style.height, undefined);
  h.handlers.message({ ...valid, data: { type: 'vpbx:dialog', open: false } });
  assert.equal(h.classes.size, 0); assert.equal(h.placeholder.hidden, true); assert.equal(h.body.style.overflow, 'auto'); assert.deepEqual(h.window.restored, [0,120]);
});
