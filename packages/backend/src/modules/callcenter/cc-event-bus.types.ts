/**
 * Typed CC event bus overlay (D-41a).
 *
 * Discriminated union over the existing CallCenterStateService RxJS Subject.
 * Runtime mechanism unchanged — this is a type-safe contract for AI consumers
 * and future paid modules (media.pcmFrame slot for transcription, D-41c).
 */
import type { AgentState, CallState, QueueState } from './callcenter-state.service';

export type CcEventBusEvent =
  | { type: 'agent.stateChanged'; agent: AgentState }
  | { type: 'call.started'; call: CallState }
  | { type: 'call.ended'; call: CallState; disposition: 'answered' | 'abandoned' | 'transferred' }
  | { type: 'queue.statsChanged'; queue: QueueState }
  | { type: 'media.pcmFrame'; channelId: string; frame: Buffer; callUniqueid?: string };

/**
 * Map a raw CcEvent (SSE envelope) into a CcEventBusEvent when the type is known.
 * Returns null for legacy SSE types that are not part of the typed AI contract.
 */
export function mapCcEventToBusEvent(type: string, data: any): CcEventBusEvent | null {
  switch (type) {
    case 'agent.stateChanged':
      return { type: 'agent.stateChanged', agent: data as AgentState };
    case 'call.started':
      return { type: 'call.started', call: data as CallState };
    case 'call.ended':
      return {
        type: 'call.ended',
        call: data as CallState,
        disposition: (data?.disposition ?? 'answered') as 'answered' | 'abandoned' | 'transferred',
      };
    case 'queue.statsChanged':
      return { type: 'queue.statsChanged', queue: data as QueueState };
    case 'media.pcmFrame':
      return {
        type: 'media.pcmFrame',
        channelId: String(data?.channelId ?? ''),
        frame: Buffer.isBuffer(data?.frame) ? data.frame : Buffer.from(data?.frame ?? []),
        callUniqueid: data?.callUniqueid,
      };
    // Legacy SSE aliases → typed contract (optional bridging for consumers)
    case 'agentUpdate':
      return { type: 'agent.stateChanged', agent: data as AgentState };
    case 'queueUpdate':
      return { type: 'queue.statsChanged', queue: data as QueueState };
    case 'callNew':
      return { type: 'call.started', call: data as CallState };
    case 'callEnd':
      return {
        type: 'call.ended',
        call: data as CallState,
        disposition: mapDisposition(data?.reason),
      };
    default:
      return null;
  }
}

function mapDisposition(reason: unknown): 'answered' | 'abandoned' | 'transferred' {
  if (reason === 'abandoned' || reason === 'transferred') return reason;
  return 'answered';
}
