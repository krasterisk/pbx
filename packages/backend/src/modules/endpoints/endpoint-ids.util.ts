/**
 * SIP endpoint ID helpers.
 *
 * Primary:  e{extension}_{tenant}   e.g. e110_0
 * WebRTC:   ew{extension}_{tenant}  e.g. ew110_0
 */

/** Matches e110_0 or ew110_0; group1 = optional "w", group2 = extension, group3 = tenant */
const SIP_ID_RE = /^e(w?)(.+)_(\d+)$/;
const PRIMARY_ID_RE = /^e(?!w)(.+)_(\d+)$/;

export function buildSipId(vpbxUserUid: number, extension: string): string {
  return `e${extension}_${vpbxUserUid}`;
}

export function buildWebrtcSipId(vpbxUserUid: number, extension: string): string {
  return `ew${extension}_${vpbxUserUid}`;
}

export function isWebrtcCompanion(sipId: string): boolean {
  return /^ew.+_\d+$/.test(sipId);
}

/** Extract user-facing extension: e110_0 / ew110_0 → "110" */
export function extractExtension(sipId: string): string {
  const match = sipId.match(SIP_ID_RE);
  return match ? match[2] : sipId;
}

export function companionIdOf(primaryId: string): string | null {
  const match = primaryId.match(PRIMARY_ID_RE);
  if (!match) return null;
  return `ew${match[1]}_${match[2]}`;
}

export function primaryIdOf(companionId: string): string | null {
  const match = companionId.match(/^ew(.+)_(\d+)$/);
  if (!match) return null;
  return `e${match[1]}_${match[2]}`;
}

/**
 * Asterisk queue/agent interface → dialable extension.
 * PJSIP/ew110_0 → "110", PJSIP/e110_0 → "110"
 */
export function interfaceToExtension(iface: string): string {
  const id = iface.includes('/') ? iface.split('/').pop() || iface : iface;
  return extractExtension(id);
}
