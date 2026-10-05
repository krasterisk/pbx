export type TrunkReachabilityStatus = 'Reachable' | 'Unreachable' | 'Unqualified' | 'Unknown';

export function trunkReachability(events: Array<Record<string, unknown>>) : TrunkReachabilityStatus {
  const contacts = events.filter(event => /^(contactstatusdetail|contactlist)$/i.test(String(event.event ?? event.Event ?? '')));
  const statuses = contacts.map(event => String(event.status ?? event.Status ?? '').replace(/[ _-]/g, '').toLowerCase());
  if (statuses.some(status => ['reachable', 'avail', 'available'].includes(status))) return 'Reachable';
  if (statuses.some(status => ['nonqualified', 'nonqual', 'unqualified'].includes(status))) return 'Unqualified';
  if (statuses.length && statuses.every(status => ['unreachable', 'unavail', 'unavailable', 'removed'].includes(status))) return 'Unreachable';
  if (!contacts.length) {
    const detail = events.find(event => /^endpointdetail$/i.test(String(event.event ?? event.Event ?? '')));
    if (detail && /^(unavailable|invalid|nonexistent)$/i.test(String(detail.devicestate ?? detail.DeviceState ?? ''))) return 'Unreachable';
  }
  return 'Unknown';
}
