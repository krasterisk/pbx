export type TurnPhase = 'listening' | 'thinking' | 'speaking';

export type CascadeState = {
  phase: TurnPhase;
  inputTurnId: number;
  outputEpoch: number;
  callerBuffer: string;
  assistantQueued: string[];
  flushedEpoch: number;
  playedMs: number | null;
  terminal: boolean;
};

export function initialCascade(): CascadeState {
  return {
    phase: 'listening', inputTurnId: 0, outputEpoch: 0,
    callerBuffer: '', assistantQueued: [], flushedEpoch: 0, playedMs: null, terminal: false,
  };
}

/** Greeting is inputTurnId 0; first caller utterance becomes 1. */
export function acceptFinalStt(state: CascadeState, text: string): CascadeState {
  if (state.terminal) return state;
  const inputTurnId = state.inputTurnId === 0 && state.phase === 'listening' && !state.callerBuffer
    ? (state.outputEpoch === 0 ? 1 : state.inputTurnId + 1)
    : state.inputTurnId + 1;
  return {
    ...state,
    phase: 'thinking',
    inputTurnId,
    callerBuffer: state.callerBuffer + text,
  };
}

export function beginSpeaking(state: CascadeState, chunks: string[]): CascadeState {
  if (state.terminal || state.phase !== 'thinking') return state;
  return { ...state, phase: 'speaking', assistantQueued: chunks };
}

export function bargeIn(state: CascadeState, preRoll: string): CascadeState {
  if (state.terminal) return state;
  return {
    ...state,
    phase: 'listening',
    outputEpoch: state.outputEpoch + 1,
    flushedEpoch: state.outputEpoch,
    assistantQueued: [],
    callerBuffer: preRoll,
    playedMs: state.playedMs,
  };
}

export function serialPlayback(chunks: Array<{ epoch: number; seq: number; text: string }>): string[] {
  return [...chunks]
    .filter(chunk => Number.isInteger(chunk.epoch) && Number.isInteger(chunk.seq))
    .sort((a, b) => a.epoch - b.epoch || a.seq - b.seq)
    .map(chunk => chunk.text);
}

export function ignoreLateCallback(state: CascadeState, epoch: number): boolean {
  return epoch <= state.flushedEpoch;
}

export function markUncertainPlayed(state: CascadeState): CascadeState {
  return { ...state, playedMs: null };
}
