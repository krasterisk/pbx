import type { IEndpointListItem } from '@/shared/api/endpoints/endpointApi';
import type { IDirectoryEndpoint } from '@/shared/api/endpoints/callCenterApi';
import type { IAgent } from '../model/types/callCenterSchema';
import { buildPrimarySipId } from '@/features/endpoints/lib/endpointIds';

export type EndpointUnavailable = 'occupied' | 'busy' | 'webrtcDisabled' | 'unregistered';
const BUSY_PRESENCE = new Set(['INUSE', 'IN_USE', 'BUSY', 'RINGING', 'RINGINUSE', 'ONHOLD', 'HOLD', 'IN_CALL', 'DIALING', 'CONSULT', '1', '2', '8', '9', '16', '17']);

/** A primary and its browser companion share one extension/shift ownership. */
export function shiftEndpointUnavailable(
  endpoint: IEndpointListItem,
  mode: 'sip' | 'webrtc',
  agents: readonly IAgent[],
  directory: readonly IDirectoryEndpoint[] = [],
): EndpointUnavailable | null {
  const primaryId = buildPrimarySipId(endpoint.id) || endpoint.id;
  const sameSubscriber = (rawId: string): boolean => {
    const id = rawId.replace(/^(PJSIP|SIP)\//, '');
    return id === endpoint.id || id === endpoint.webrtc?.id || (buildPrimarySipId(id) || id) === primaryId;
  };
  // The tenant suffix is part of identity: e201_362 and e201_7 are different
  // subscribers even though their visible extension is the same.
  const related = agents.filter(agent => agent.interface && !agent.interface.startsWith('user:')
    && sameSubscriber(agent.interface));
  if (related.some(agent => agent.userId && agent.status !== 'OFFLINE')) return 'occupied';
  if (related.some(agent => ['IN_CALL', 'RINGING', 'DIALING', 'CONSULT'].includes(agent.status))
    || directory.some(row => sameSubscriber(row.id)
      && BUSY_PRESENCE.has(row.presence.toUpperCase().replace(/[- ]/g, '_')))) return 'busy';
  if (mode === 'webrtc' && !endpoint.webrtc_enabled && !endpoint.webrtc?.id) return 'webrtcDisabled';
  // The browser will register its own companion during login. An already-online
  // primary OR companion is sufficient; do not require the companion specifically.
  if (endpoint.status !== 'online' && (mode !== 'webrtc' || endpoint.webrtc?.status !== 'online')) return 'unregistered';
  return null;
}
