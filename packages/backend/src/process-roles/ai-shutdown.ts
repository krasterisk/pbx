export type ShutdownState = {
  claiming: boolean;
  inflight: number;
  draining: boolean;
};

export function beginGracefulShutdown(state: ShutdownState): ShutdownState {
  return { claiming: false, inflight: state.inflight, draining: true };
}

export function completeInflight(state: ShutdownState): ShutdownState {
  if (state.inflight <= 0) return { ...state, inflight: 0 };
  return { ...state, inflight: state.inflight - 1 };
}

export function mayForceReleaseUnknown(): boolean {
  return false;
}
