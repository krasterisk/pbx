import { describe, expect, it } from 'vitest';
import type { IEndpointListItem } from '@/shared/api/endpoints/endpointApi';
import type { IAgent } from '../model/types/callCenterSchema';
import { shiftEndpointUnavailable } from './shiftEndpointEligibility';

const endpoint = (overrides: Partial<IEndpointListItem> = {}) => ({
  id: 'e201_362', extension: '201', status: 'online', webrtc_enabled: true,
  webrtc: { id: 'ew201_362', status: 'offline' }, ...overrides,
} as IEndpointListItem);
describe('shift phone eligibility', () => {
  it('does not conflate the same extension in different tenants for ownership, calls or BLF', () => {
    const agents = [{ interface: 'PJSIP/ew201_7', userId: 99, status: 'IN_CALL' }] as IAgent[];
    const directory = [{ type: 'endpoint' as const, id: 'e201_7', extension: '201', label: '201', presence: 'INUSE' }];
    expect(shiftEndpointUnavailable(endpoint(), 'webrtc', agents, directory)).toBeNull();
    expect(shiftEndpointUnavailable(endpoint(), 'sip', [{ ...agents[0], userId: 0 }], directory)).toBeNull();
    expect(shiftEndpointUnavailable(endpoint({ status: 'offline' }), 'webrtc', agents, directory)).toBe('unregistered');
  });
  it('allows the browser to register an enabled companion when the primary is online', () => {
    expect(shiftEndpointUnavailable(endpoint(), 'webrtc', [])).toBeNull();
  });
  it('disables unsupported WebRTC but keeps a registered SIP endpoint available', () => {
    const phone = endpoint({ webrtc_enabled: false, webrtc: null });
    expect(shiftEndpointUnavailable(phone, 'webrtc', [])).toBe('webrtcDisabled');
    expect(shiftEndpointUnavailable(phone, 'sip', [])).toBeNull();
  });
  it('blocks unregistered numbers in either mode, but recognizes a registered browser companion', () => {
    expect(shiftEndpointUnavailable(endpoint({ status: 'offline' }), 'webrtc', [])).toBe('unregistered');
    expect(shiftEndpointUnavailable(endpoint({ status: 'offline' }), 'sip', [])).toBe('unregistered');
    expect(shiftEndpointUnavailable(endpoint({ status: 'offline', webrtc: { id: 'ew201_362', status: 'online' } }), 'webrtc', [])).toBeNull();
  });
  it('shares ownership between SIP and WebRTC, including paused shifts', () => {
    const agents = [{ interface: 'PJSIP/ew201_362', userId: 371, status: 'PAUSED' }] as IAgent[];
    expect(shiftEndpointUnavailable(endpoint(), 'sip', agents)).toBe('occupied');
    expect(shiftEndpointUnavailable(endpoint(), 'webrtc', agents)).toBe('occupied');
    expect(shiftEndpointUnavailable(endpoint(), 'webrtc', [{ ...agents[0], status: 'OFFLINE' }])).toBeNull();
  });
  it('blocks calls even when no call-center operator owns the extension', () => {
    expect(shiftEndpointUnavailable(endpoint(), 'webrtc', [{ interface: 'PJSIP/e201_362', status: 'RINGING', userId: 0 } as IAgent])).toBe('busy');
    expect(shiftEndpointUnavailable(endpoint(), 'webrtc', [], [{ type: 'endpoint', id: 'e201_362', extension: '201', label: '201', presence: 'INUSE' }])).toBe('busy');
    expect(shiftEndpointUnavailable(endpoint(), 'webrtc', [], [{ type: 'endpoint', id: 'e202_362', extension: '202', label: '202', presence: 'INUSE' }])).toBeNull();
  });
});
