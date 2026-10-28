/** Opt-in benchmark build only. Never includes tokens, names or telephone numbers. */
const enabled = import.meta.env.VITE_CC_BENCHMARK === 'true';
// Page filter normalization may replace search parameters before the effect
// opens its stream. Capture the explicitly selected A/B transport at page load.
const requestedTransport = new URLSearchParams(window.location.search).get('ccTransport');
const samples: Array<{ id: string; status: string; receivedAt: number; domAt?: number; frameAt?: number }> = [];
const pending = new Map<string, (typeof samples)[number]>();
const resources: Array<{ path: string; duration: number; status: number }> = [];
let started = false;

export function benchmarkTransport(): 'sse' | 'websocket' {
  return enabled && requestedTransport === 'sse'
    ? 'sse' : 'websocket';
}

export function recordBenchmarkEvent(type: string, payload: unknown): void {
  if (!enabled || type !== 'callUpdate' || typeof payload !== 'string') return;
  try {
    const call = JSON.parse(payload) as { uniqueid?: unknown; status?: unknown };
    if (typeof call.uniqueid !== 'string' || typeof call.status !== 'string' || samples.length >= 50000) return;
    const item = { id: call.uniqueid, status: call.status, receivedAt: Date.now() };
    samples.push(item);
    pending.set(`${item.id}:${item.status}`, item);
  } catch { /* Invalid events remain the regular adapter's responsibility. */ }
  if (started) return;
  started = true;
  const inspect = () => {
    document.querySelectorAll<HTMLElement>('[data-call-id][data-status]').forEach(row => {
      const key = `${row.dataset.callId}:${row.dataset.status}`;
      const item = pending.get(key);
      if (!item) return;
      item.domAt = Date.now();
      pending.delete(key);
      requestAnimationFrame(() => { item.frameAt = Date.now(); });
    });
  };
  new MutationObserver(inspect).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-status'] });
  new PerformanceObserver(list => {
    list.getEntries().forEach(entry => {
      if (resources.length >= 50000) return;
      const resource = entry as PerformanceResourceTiming & { responseStatus?: number };
      resources.push({ path: new URL(resource.name).pathname, duration: resource.duration, status: resource.responseStatus || 0 });
    });
  }).observe({ type: 'resource', buffered: true });
  const output = document.createElement('pre');
  output.hidden = true;
  output.dataset.testid = 'callcenter-benchmark-results';
  document.body.append(output);
  window.setInterval(() => {
    output.textContent = JSON.stringify({ transport: benchmarkTransport(), at: Date.now(), samples, resources,
      rows: document.querySelectorAll('[data-call-id]').length,
      visibility: document.visibilityState,
      note: 'frameAt is next animation frame; offscreen DOM is not proof of visible paint' });
  }, 2000);
}
