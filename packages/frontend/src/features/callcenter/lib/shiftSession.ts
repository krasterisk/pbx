import type { SoftphoneMode } from '../ui/ShiftLoginModal/ShiftLoginModal';

/** sessionStorage key for active operator shift (survives refresh, not logout). */
export const CC_ACTIVE_SHIFT_KEY = 'cc:activeShift';

/**
 * Independent of ActiveShiftSession — dial buffer / last number must survive F5
 * and shift clear (Phase 10 D-19).
 */
export const CC_DIAL_BUFFER_KEY = 'cc:dialBuffer';

export interface ActiveShiftSession {
  interface: string;
  queues: string[];
  mode: SoftphoneMode;
  /** Primary SIP endpoint id (for credential re-fetch). */
  endpointId: string;
  /** WebRTC companion / member sip id when mode=webrtc. */
  sipId: string;
  micDeviceId?: string;
  sinkId?: string;
}

export interface DialBufferSession {
  dialBuffer: string;
  lastNumber: string;
}

export function loadActiveShift(
  storage: Pick<Storage, 'getItem'> = sessionStorage,
): ActiveShiftSession | null {
  try {
    const raw = storage.getItem(CC_ACTIVE_SHIFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveShiftSession>;
    if (
      !parsed
      || typeof parsed.interface !== 'string'
      || !Array.isArray(parsed.queues)
      || (parsed.mode !== 'sip' && parsed.mode !== 'webrtc')
      || typeof parsed.endpointId !== 'string'
      || typeof parsed.sipId !== 'string'
    ) {
      return null;
    }
    return {
      interface: parsed.interface,
      queues: parsed.queues.filter((q): q is string => typeof q === 'string'),
      mode: parsed.mode,
      endpointId: parsed.endpointId,
      sipId: parsed.sipId,
      micDeviceId: typeof parsed.micDeviceId === 'string' ? parsed.micDeviceId : undefined,
      sinkId: typeof parsed.sinkId === 'string' ? parsed.sinkId : undefined,
    };
  } catch {
    return null;
  }
}

export function saveActiveShift(
  shift: ActiveShiftSession,
  storage: Pick<Storage, 'setItem'> = sessionStorage,
): void {
  storage.setItem(CC_ACTIVE_SHIFT_KEY, JSON.stringify(shift));
}

export function clearActiveShift(
  storage: Pick<Storage, 'removeItem'> = sessionStorage,
): void {
  storage.removeItem(CC_ACTIVE_SHIFT_KEY);
}

export function loadDialBuffer(
  storage: Pick<Storage, 'getItem'> = sessionStorage,
): DialBufferSession | null {
  try {
    const raw = storage.getItem(CC_DIAL_BUFFER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DialBufferSession>;
    if (
      !parsed
      || typeof parsed.dialBuffer !== 'string'
      || typeof parsed.lastNumber !== 'string'
    ) {
      return null;
    }
    return {
      dialBuffer: parsed.dialBuffer,
      lastNumber: parsed.lastNumber,
    };
  } catch {
    return null;
  }
}

export function saveDialBuffer(
  dial: DialBufferSession,
  storage: Pick<Storage, 'setItem'> = sessionStorage,
): void {
  storage.setItem(CC_DIAL_BUFFER_KEY, JSON.stringify(dial));
}

export function clearDialBuffer(
  storage: Pick<Storage, 'removeItem'> = sessionStorage,
): void {
  storage.removeItem(CC_DIAL_BUFFER_KEY);
}
