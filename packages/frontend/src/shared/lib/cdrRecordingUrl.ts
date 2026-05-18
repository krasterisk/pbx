import { getAuthApiBase, getEffectiveApiBase, isStandaloneApp } from '@/shared/api/apiBase';

export function cdrRecordingStreamPath(uniqueid: string): string {
  return `/reports/cdr/recording/${encodeURIComponent(uniqueid)}/play`;
}

/** HTML player page (popup); stream is loaded from relative …/play inside the page. */
export function cdrRecordingPlayerPath(uniqueid: string): string {
  return `/reports/cdr/recording/${encodeURIComponent(uniqueid)}`;
}

/** Full URL for window.open (aiPBX / v3 play.php pattern). */
export function buildRecordingPlayUrl(uniqueid: string): string | null {
  if (!uniqueid?.trim()) return null;

  const apiBase = getEffectiveApiBase();
  const path = cdrRecordingPlayerPath(uniqueid);

  let raw = `${apiBase}${path}`;
  if (!isStandaloneApp()) {
    const token = localStorage.getItem('accessToken');
    if (token) {
      raw += `?token=${encodeURIComponent(token)}`;
    }
  }

  try {
    const urlObj = /^https?:\/\//i.test(raw)
      ? new URL(raw)
      : new URL(raw, window.location.origin);
    urlObj.pathname = urlObj.pathname.replace(/%20/g, '+').replace(/ /g, '+');
    return urlObj.toString();
  } catch {
    return raw;
  }
}

/** @deprecated use buildRecordingPlayUrl */
export function cdrRecordingStreamUrl(uniqueid: string): string {
  return buildRecordingPlayUrl(uniqueid) || '';
}

/** @deprecated use buildRecordingPlayUrl */
export function resolveCdrRecordingPlaybackUrl(
  recordingUrl: string | null | undefined,
  uniqueid?: string | null,
): string | null {
  if (uniqueid) return buildRecordingPlayUrl(uniqueid);
  if (!recordingUrl) return null;
  if (/^https?:\/\//i.test(recordingUrl)) return recordingUrl;
  const token = localStorage.getItem('accessToken');
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${getAuthApiBase()}${recordingUrl.startsWith('/') ? recordingUrl : `/${recordingUrl}`}${q}`;
}
