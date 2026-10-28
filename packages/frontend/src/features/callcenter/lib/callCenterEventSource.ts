import { io } from 'socket.io-client';

export interface CallCenterEventSource {
  readonly readyState: number;
  onopen: (() => void) | null;
  onerror: (() => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  close(): void;
}

/** Preserve the event contract while leaving HTTP slots free for normal API reads. */
export function createCallCenterEventSource(
  apiBase: string,
  token: string,
): CallCenterEventSource {
  const base = new URL(apiBase, window.location.origin);
  const listeners = new Map<string, Set<(event: MessageEvent) => void>>();
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  const socket = io(base.origin + '/callcenter-events', {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
    autoConnect: false,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  const source: CallCenterEventSource & { readyState: number } = {
    readyState: 0,
    onopen: null,
    onerror: null,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      source.readyState = 2;
      socket.removeAllListeners();
      socket.disconnect();
      listeners.clear();
    },
  };
  socket.on('connect', () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    if (closed) return;
    source.readyState = 1;
    source.onopen?.();
  });
  const disconnected = () => {
    if (closed) return;
    source.readyState = 0;
    source.onerror?.();
    // Socket.IO retries transport failures itself. A namespace rejection or
    // server disconnect needs an explicit, bounded retry after recovery.
    if (!socket.active && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        if (!closed) socket.connect();
      }, 10000);
    }
  };
  socket.on('disconnect', disconnected);
  socket.on('connect_error', disconnected);
  socket.on('cc:event', (event: { type?: unknown; data?: unknown }) => {
    if (closed || typeof event?.type !== 'string') return;
    const message = new MessageEvent(event.type, { data: event.data });
    listeners.get(event.type)?.forEach((listener) => listener(message));
  });
  socket.connect();
  return source;
}
