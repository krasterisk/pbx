import { companionIdOf, isWebrtcCompanion, primaryIdOf } from '../endpoints/endpoint-ids.util';

/** Queue member interfaces for a primary/WebRTC pair. */
export function relatedQueueInterfaces(agentInterface: string): string[] {
  const tech = agentInterface.includes('/')
    ? agentInterface.slice(0, agentInterface.indexOf('/') + 1)
    : 'PJSIP/';
  const sipId = agentInterface.includes('/')
    ? agentInterface.slice(agentInterface.indexOf('/') + 1)
    : agentInterface;

  const related = new Set<string>([`PJSIP/${sipId}`, `${tech}${sipId}`, agentInterface]);
  const twin = isWebrtcCompanion(sipId) ? primaryIdOf(sipId) : companionIdOf(sipId);
  if (twin) {
    related.add(`PJSIP/${twin}`);
    related.add(`${tech}${twin}`);
  }
  return [...related];
}

/**
 * AMI QueueMember is the displayed membership.
 * Session snapshot only lists queues to heal (QueueAdd) after Asterisk restart.
 * Never hide an AMI leftover just because the snapshot omitted it.
 */
export function planQueueMembership(
  amiQueues: readonly string[],
  snapshotQueues: readonly string[] = [],
): { display: string[]; missingFromAmi: string[] } {
  const ami = new Set(amiQueues.filter(Boolean));
  const missingFromAmi = snapshotQueues.filter((q) => q && !ami.has(q));
  const display = [...ami];
  for (const q of missingFromAmi) display.push(q);
  display.sort();
  return { display, missingFromAmi };
}

/** Union AMI membership across primary ↔ WebRTC twins onto one live agent. */
export function mergeRelatedQueueMembership(
  queuesByInterface: Map<string, Iterable<string>>,
  relatedInterfaces: readonly string[],
): string[] {
  const merged = new Set<string>();
  for (const iface of relatedInterfaces) {
    const queues = queuesByInterface.get(iface);
    if (!queues) continue;
    for (const q of queues) {
      if (q) merged.add(q);
    }
  }
  return [...merged].sort();
}
