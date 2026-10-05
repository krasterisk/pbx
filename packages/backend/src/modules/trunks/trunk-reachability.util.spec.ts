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
  it('shows an endpoint without contacts as unavailable when AMI confirms it', () => {
    expect(trunkReachability([{ event: 'EndpointDetail', devicestate: 'Unavailable' }])).toBe('Unreachable');
  });
});
