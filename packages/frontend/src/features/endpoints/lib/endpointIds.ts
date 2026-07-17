/**
 * SIP endpoint ID helpers (mirrors backend endpoint-ids.util.ts).
 * Primary: e{ext}_{tenant} · WebRTC companion: ew{ext}_{tenant}
 */

const SIP_ID_RE = /^e(w?)(.+)_(\d+)$/;

export function isWebrtcCompanion(sipId: string): boolean {
  return /^ew.+_\d+$/.test(sipId);
}

export function extractExtension(sipId: string): string {
  const match = sipId.match(SIP_ID_RE);
  return match ? match[2] : sipId;
}

export function buildWebrtcSipId(primaryId: string): string | null {
  const match = primaryId.match(/^e(?!w)(.+)_(\d+)$/);
  if (!match) return null;
  return `ew${match[1]}_${match[2]}`;
}

/** PJSIP/ew110_0 → "110" */
export function interfaceToExtension(iface: string): string {
  const id = iface.includes('/') ? iface.split('/').pop() || iface : iface;
  return extractExtension(id);
}
