import { describe, it, expect } from 'vitest';
import {
  buildNatProfilePatch,
  detectNatProfile,
} from './natProfiles';

describe('natProfiles', () => {
  it('webrtc patch enables webrtc + dtls fields', () => {
    const patch = buildNatProfilePatch('webrtc');
    expect(patch.webrtc).toBe('yes');
    expect(patch.media_encryption).toBe('dtls');
    expect(patch.dtls_auto_generate_cert).toBe('yes');
    expect(patch.rtcp_mux).toBe('yes');
    expect(patch.bundle).toBe('yes');
    expect(patch.ice_support).toBe('yes');
  });

  it('nat / lan patches clear webrtc-only fields', () => {
    expect(buildNatProfilePatch('nat').webrtc).toBeNull();
    expect(buildNatProfilePatch('lan').media_encryption).toBeNull();
    expect(buildNatProfilePatch('lan').direct_media).toBe('yes');
  });

  it('detectNatProfile prefers webrtc when flag is set', () => {
    expect(detectNatProfile({ webrtc: 'yes', direct_media: 'no', force_rport: 'yes' })).toBe('webrtc');
    expect(detectNatProfile({ webrtc: null, direct_media: 'yes', force_rport: 'no' })).toBe('lan');
    expect(detectNatProfile({ webrtc: null, direct_media: 'no', force_rport: 'yes' })).toBe('nat');
  });
});
