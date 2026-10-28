/** Opt-in benchmark build only. Never includes tokens, names or telephone numbers. */
const enabled = import.meta.env.VITE_CC_BENCHMARK === 'true';
// Page filter normalization may replace search parameters before the effect
// opens its stream. Capture the explicitly selected A/B transport at page load.
const requestedTransport = new URLSearchParams(window.location.search).get('ccTransport');
const measure = enabled && new URLSearchParams(window.location.search).get('ccMeasure') !== 'off';
const samples: Array<{ id: string; status: string; receivedAt: number; domAt?: number; frameAt?: number }> = [];
const pending = new Map<string, (typeof samples)[number]>();
const resources: Array<{ path: string; duration: number; status: number }> = [];
let started = false;
let snapshot: { agents: number; calls: number; queues: number; at: number } | undefined;
let observerErrors = 0;

export function benchmarkTransport(): 'sse' | 'websocket' {
  return enabled && requestedTransport === 'sse'
    ? 'sse' : 'websocket';
}

export function recordBenchmarkEvent(type: string, payload: unknown): void {
  if (!measure || !['callUpdate', 'fullSnapshot'].includes(type) || typeof payload !== 'string') return;
  try {
    const data = JSON.parse(payload);
    if (type === 'fullSnapshot') {
      snapshot = { agents: data.agents?.length || 0, calls: data.calls?.length || 0, queues: data.queues?.length || 0, at: Date.now() };
    } else if (typeof data.uniqueid === 'string' && typeof data.status === 'string' && samples.length < 10000) {
      const item = { id: data.uniqueid, status: data.status, receivedAt: Date.now() };
      samples.push(item);
      pending.set(`${item.id}:${item.status}`, item);
    }
    if (!started) startObservers();
  } catch { observerErrors++; /* Instrumentation must never interrupt application delivery. */ }
}

function startObservers() {
  started = true;
  const inspect = (row: HTMLElement) => {
      const key = `${row.dataset.callId}:${row.dataset.status}`;
      const item = pending.get(key);
      if (!item) return;
      item.domAt = Date.now();
      pending.delete(key);
      requestAnimationFrame(() => { item.frameAt = Date.now(); });
  };
  new MutationObserver(records => {
    if (!pending.size) return;
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLElement && record.target.dataset.callId) inspect(record.target);
      // Timer text changes are deliberately ignored. Inspect only newly added rows.
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.dataset.callId) inspect(node);
        node.querySelectorAll<HTMLElement>('[data-call-id][data-status]').forEach(inspect);
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-status'] });
  if (typeof PerformanceObserver !== 'undefined') new PerformanceObserver(list => {
    list.getEntries().forEach(entry => {
      if (resources.length >= 10000) return;
      const resource = entry as PerformanceResourceTiming & { responseStatus?: number };
      resources.push({ path: new URL(resource.name).pathname, duration: resource.duration, status: resource.responseStatus || 0 });
    });
  }).observe({ type: 'resource', buffered: true });
  const output = document.createElement('pre');
  output.hidden = true;
  output.dataset.testid = 'callcenter-benchmark-results';
  document.body.append(output);
  window.setInterval(() => {
    output.textContent = JSON.stringify({ transport: benchmarkTransport(), at: Date.now(), snapshot, observerErrors, samples, resources,
      rows: document.querySelectorAll('[data-call-id]').length,
      visibility: document.visibilityState,
      note: 'frameAt is next animation frame; offscreen DOM is not proof of visible paint' });
  }, 2000);
}
