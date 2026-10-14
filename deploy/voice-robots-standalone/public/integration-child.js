(function () {
  'use strict';
  if (window.parent === window || new URLSearchParams(location.search).get('embedded') !== '1') return;
  const origin = location.origin;
  const validRoute = /^\/(?:voice-robots(?:\/(?:cdr|create|[0-9]+))?|settings\/(?:stt|tts)-engines)(?:\?[A-Za-z0-9_=&%.-]*)?$/;
  document.documentElement.classList.add('vpbx-embedded');
  function send(type, extra) { parent.postMessage(Object.assign({ type }, extra), origin); }
  let scheduled = false;
  let lastHeight = 0;
  let lastDialog = null;
  function resize() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      const root = document.getElementById('root') || document.body;
      const bounds = root.getBoundingClientRect();
      const height = Math.ceil(bounds.height + (root === document.body ? Math.max(0, bounds.top + window.scrollY) + 32 : 0));
      if (height !== lastHeight) { lastHeight = height; send('vpbx:height', { height }); }
      const open = Boolean(document.querySelector('[data-modal-shell][data-state="open"], [role="dialog"][data-state="open"], dialog[open]'));
      if (open !== lastDialog) { lastDialog = open; send('vpbx:dialog', { open }); }
    });
  }
  window.addEventListener('message', function (event) {
    if (event.origin !== origin || event.source !== parent || !event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'vpbx:navigate' && typeof event.data.route === 'string' && validRoute.test(event.data.route)) {
      if (location.hash.slice(1) !== event.data.route) location.hash = event.data.route;
    }
    if (event.data.type === 'vpbx:context' && event.data.context && event.data.context.module === 'voice-robots') {
      const raw = event.data.context;
      // Display context only. api.php independently validates the PHP session and tenant.
      const context = Object.freeze({ module: 'voice-robots', tenantUid: Number(raw.tenantUid), tenantName: String(raw.tenantName || ''),
        userName: String(raw.userName || ''), roleLevel: Number(raw.roleLevel), locale: raw.locale === 'en' ? 'en' : 'ru' });
      window.VpbxVoiceRobotsContext = context;
      document.documentElement.lang = context.locale;
      window.dispatchEvent(new CustomEvent('vpbx:context', { detail: context }));
    }
  });
  window.addEventListener('hashchange', function () { const value = location.hash.slice(1); if (validRoute.test(value)) send('vpbx:route', { route: value }); resize(); });
  function start() {
    const observer = new ResizeObserver(resize);
    observer.observe(document.getElementById('root') || document.body);
    // React dialogs portal outside #root. Track their open state without moving portals into legacy CSS.
    new MutationObserver(resize).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'open'] });
    send('vpbx:ready'); resize();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}());
