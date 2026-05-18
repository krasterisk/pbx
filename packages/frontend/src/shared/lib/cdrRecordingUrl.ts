import { getAuthApiBase } from '@/shared/api/apiBase';

/**
 * Same-origin playback path (v3 play.php pattern — file streamed via API).
 */
export function cdrRecordingStreamPath(uniqueid: string): string {
  return `/reports/cdr/recording/${encodeURIComponent(uniqueid)}/play`;
}

/** URL for fetch() with Authorization header (preferred for <audio>). */
export function cdrRecordingStreamUrl(uniqueid: string): string {
  return `${getAuthApiBase()}${cdrRecordingStreamPath(uniqueid)}`;
}

/**
 * Fallback for <audio src> when blob fetch is not used — JWT in query (JwtStrategy).
 */
export function resolveCdrRecordingPlaybackUrl(
  recordingUrl: string | null | undefined,
  uniqueid?: string | null,
): string | null {
  const path = recordingUrl || (uniqueid ? cdrRecordingStreamPath(uniqueid) : null);
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const apiPath = path.startsWith('/') ? path : `/${path}`;
  const token = localStorage.getItem('accessToken');
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${getAuthApiBase()}${apiPath}${q}`;
}
