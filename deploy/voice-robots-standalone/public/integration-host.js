(function () {
  'use strict';
  const frame = document.getElementById('vpbx-voice-robots-frame');
  const contextNode = document.getElementById('vpbx-voice-robots-context');
  if (!frame || !contextNode) return;
  const context = JSON.parse(contextNode.textContent);
  const origin = location.origin;
  const validRoute = /^\/(?:voice-robots(?:\/(?:cdr|create|[0-9]+))?|settings\/(?:stt|tts)-engines|mcp-access)(?:\?[A-Za-z0-9_=&%.-]*)?$/;
  let currentPage = null;
  let dialogOpen = false;
  let bodyOverflow = '';
  let scrollPosition = [0, 0];
  function dialogMode(open) {
    if (open === dialogOpen) return;
    dialogOpen = open;
    const placeholder = document.getElementById('vpbx-voice-robots-placeholder');
    if (open) {
      bodyOverflow = document.body.style.overflow;
      scrollPosition = [window.scrollX, window.scrollY];
      if (placeholder) { placeholder.style.height = frame.getBoundingClientRect().height + 'px'; placeholder.hidden = false; }
      document.body.style.overflow = 'hidden';
      frame.classList.add('vpbx-dialog-mode');
    } else {
      frame.classList.remove('vpbx-dialog-mode');
      if (placeholder) placeholder.hidden = true;
      document.body.style.overflow = bodyOverflow;
      window.scrollTo(scrollPosition[0], scrollPosition[1]);
    }
  }
  function route() { const value = location.hash.slice(1); return validRoute.test(value) ? value : '/voice-robots'; }
  function send(type, extra) { if (frame.contentWindow) frame.contentWindow.postMessage(Object.assign({ type }, extra), origin); }
  function contextMessage() { send('vpbx:context', { context }); }
  function synchronize() {
    const value = route();
    const nextPage = value.split('?')[0] === '/mcp-access' ? 'mcp' : 'robots';
    document.querySelectorAll('#vpbx-voice-robots-tabs [data-voice-route]').forEach(function (link) {
      const target = link.getAttribute('data-voice-route');
      const active = target === '/voice-robots' ? value.startsWith('/voice-robots') && !value.startsWith('/voice-robots/cdr') : value.split('?')[0] === target;
      link.parentElement.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    if (currentPage !== nextPage) {
      dialogMode(false);
      currentPage = nextPage;
      frame.src = '/modules/voice-robots/' + (nextPage === 'mcp' ? 'mcp-access.html?embedded=1&ui=6' : 'standalone.html?embedded=1&ui=6#' + value);
    } else {
      send('vpbx:navigate', { route: value });
      contextMessage();
    }
  }
  window.addEventListener('message', function (event) {
    if (event.origin !== origin || event.source !== frame.contentWindow || !event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'vpbx:ready') { contextMessage(); synchronize(); }
    if (event.data.type === 'vpbx:dialog' && typeof event.data.open === 'boolean') dialogMode(event.data.open);
    if (event.data.type === 'vpbx:height' && Number.isFinite(event.data.height)) {
      if (!dialogOpen) frame.style.height = Math.max(360, Math.min(30000, Math.ceil(event.data.height))) + 'px';
    }
    if (event.data.type === 'vpbx:route' && typeof event.data.route === 'string' && validRoute.test(event.data.route)) {
      if (route() !== event.data.route) location.hash = event.data.route;
    }
  });
  frame.addEventListener('load', function () { dialogMode(false); contextMessage(); synchronize(); });
  window.addEventListener('hashchange', synchronize);
  synchronize();
}());
