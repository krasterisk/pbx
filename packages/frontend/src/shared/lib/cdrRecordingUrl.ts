import { getAuthApiBase, isStandaloneApp } from '@/shared/api/apiBase';

export function cdrRecordingStreamPath(uniqueid: string, standalone = isStandaloneApp()): string {
  const prefix = standalone ? '/public' : '';
  return `${prefix}/reports/cdr/recording/${encodeURIComponent(uniqueid)}/play`;
}

/** Full URL for window.open / <audio> (aiPBX / v3 play.php pattern). */
export function buildRecordingPlayUrl(uniqueid: string): string | null {
  if (!uniqueid?.trim()) return null;

  let raw = '';
  const apiBase = isStandaloneApp()
    ? `${getAuthApiBase()}/public`
    : getAuthApiBase();
  const path = cdrRecordingStreamPath(uniqueid, isStandaloneApp());

  if (!isStandaloneApp()) {
    const token = localStorage.getItem('accessToken');
    const q = token ? `?token=${encodeURIComponent(token)}` : '';
    raw = `${apiBase}${path}${q}`;
  } else {
    raw = `${apiBase}${path}`;
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
