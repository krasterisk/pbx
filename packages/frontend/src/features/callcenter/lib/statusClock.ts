type TickListener = () => void;

const listeners = new Set<TickListener>();
let timerId: number | null = null;

function startClock(): void {
  if (timerId != null || typeof window === 'undefined') return;
  timerId = window.setInterval(() => {
    listeners.forEach((listener) => listener());
  }, 1000);
}

function stopClock(): void {
  if (timerId == null) return;
  window.clearInterval(timerId);
  timerId = null;
}

/** One shared 1s clock for status-duration cells. Idle when nobody is subscribed. */
export function subscribeStatusClock(listener: TickListener): () => void {
  listeners.add(listener);
  startClock();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopClock();
  };
}
