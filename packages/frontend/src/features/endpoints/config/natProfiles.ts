/**
 * NAT profile presets — must stay in sync with backend
 * `packages/backend/src/modules/endpoints/endpoints.service.ts` NAT_PROFILES.
 *
 * Applied on create (via `natProfile` DTO) and on update (merged into endpoint fields,
 * because the update API accepts raw PJSIP columns, not the profile name).
 */

export type NatProfileId = 'lan' | 'nat' | 'webrtc';

/** Primary endpoint NAT options — WebRTC profile lives only on the companion. */
export type PrimaryNatProfileId = 'lan' | 'nat';

export const NAT_PROFILE_OPTIONS: { value: NatProfileId; labelKey: string }[] = [
  { value: 'lan', labelKey: 'endpoints.natLan' },
  { value: 'nat', labelKey: 'endpoints.natNat' },
  { value: 'webrtc', labelKey: 'endpoints.natWebrtc' },
];

/** Options shown on the primary endpoint form (desk phone / softphone). */
export const PRIMARY_NAT_PROFILE_OPTIONS: { value: PrimaryNatProfileId; labelKey: string }[] = [
  { value: 'lan', labelKey: 'endpoints.natLan' },
  { value: 'nat', labelKey: 'endpoints.natNat' },
];

/** Fields that belong only to the WebRTC profile — cleared when switching away. */
const WEBRTC_ONLY_KEYS = [
  'webrtc',
  'dtls_auto_generate_cert',
  'media_encryption',
  'rtcp_mux',
  'bundle',
] as const;

export const NAT_PROFILE_SETTINGS: Record<NatProfileId, Record<string, string>> = {
  lan: {
    direct_media: 'yes',
    force_rport: 'no',
    rewrite_contact: 'no',
    rtp_symmetric: 'no',
    ice_support: 'no',
  },
  nat: {
    direct_media: 'no',
    force_rport: 'yes',
    rewrite_contact: 'yes',
    rtp_symmetric: 'yes',
    ice_support: 'yes',
  },
  webrtc: {
    direct_media: 'no',
    force_rport: 'yes',
    rewrite_contact: 'yes',
    rtp_symmetric: 'yes',
    ice_support: 'yes',
    webrtc: 'yes',
    dtls_auto_generate_cert: 'yes',
    media_encryption: 'dtls',
    rtcp_mux: 'yes',
    bundle: 'yes',
  },
};

/**
 * Resolve the full set of endpoint columns for a NAT profile.
 * Non-WebRTC profiles explicitly null out WebRTC-only keys so they don't linger.
 */
export function buildNatProfilePatch(
  profile: NatProfileId,
): Record<string, string | null> {
  const settings = { ...NAT_PROFILE_SETTINGS[profile] } as Record<string, string | null>;
  if (profile !== 'webrtc') {
    for (const key of WEBRTC_ONLY_KEYS) {
      if (!(key in settings)) settings[key] = null;
    }
  }
  return settings;
}

/** Infer UI profile from stored endpoint columns (best-effort). */
export function detectNatProfile(endpoint: {
  webrtc?: string | null;
  direct_media?: string | null;
  force_rport?: string | null;
}): NatProfileId {
  if (endpoint.webrtc === 'yes') return 'webrtc';
  if (endpoint.direct_media === 'yes' && endpoint.force_rport === 'no') return 'lan';
  return 'nat';
}
