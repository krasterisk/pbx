import { trunkReachability } from './trunk-reachability.util';

describe('trunk reachability from AMI contacts', () => {
  it.each([
    ['Reachable', 'Reachable'], ['Avail', 'Reachable'], ['Unreachable', 'Unreachable'],
    ['NonQualified', 'Unqualified'], ['NonQual', 'Unqualified'], ['Created', 'Unknown'],
    ['Unknown', 'Unknown'], ['', 'Unknown'],
  ])('maps %s to %s', (status, expected) => {
    expect(trunkReachability([{ event: 'ContactStatusDetail', status }])).toBe(expected);
  });
  it('accepts AMI field casing and any reachable contact', () => {
    expect(trunkReachability([{ Event: 'ContactList', Status: 'Unreachable' }, { event: 'ContactStatusDetail', status: 'Reachable' }])).toBe('Reachable');
  });
  it('never treats incomplete AMI data or idle DeviceState as reachable', () => {
    expect(trunkReachability([])).toBe('Unknown');
    expect(trunkReachability([{ event: 'EndpointDetail', devicestate: 'Not in use' }])).toBe('Unknown');
  });
  it.each(['Unavailable', 'Not in use', 'Invalid'])('distinguishes no contacts from a physical outage for DeviceState %s', (devicestate) => {
    expect(trunkReachability([{ event: 'EndpointDetail', devicestate }], true)).toBe('NoContacts');
    expect(trunkReachability([{ event: 'EndpointDetail', devicestate }], false)).toBe('Unknown');
  });
});
