export type TrunkReachabilityStatus = 'Reachable' | 'Unreachable' | 'Unqualified' | 'NoContacts' | 'Unknown';

export function trunkReachability(events: Array<Record<string, unknown>>, complete = false) : TrunkReachabilityStatus {
  const contacts = events.filter(event => /^(contactstatusdetail|contactlist)$/i.test(String(event.event ?? event.Event ?? '')));
  const statuses = contacts.map(event => String(event.status ?? event.Status ?? '').replace(/[ _-]/g, '').toLowerCase());
  if (statuses.some(status => ['reachable', 'avail', 'available'].includes(status))) return 'Reachable';
  if (statuses.some(status => ['nonqualified', 'nonqual', 'unqualified'].includes(status))) return 'Unqualified';
  if (statuses.length && statuses.every(status => ['unreachable', 'unavail', 'unavailable', 'removed'].includes(status))) return 'Unreachable';
  if (!contacts.length) {
    const detail = events.find(event => /^endpointdetail$/i.test(String(event.event ?? event.Event ?? '')));
    // An inbound-only IP trunk may have no AoR contact while its provider is online.
    // Only a completed endpoint snapshot proves that no contacts exist.
    if (detail && complete) return 'NoContacts';
  }
  return 'Unknown';
}
