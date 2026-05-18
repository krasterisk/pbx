/**
 * Same-origin playback URL for CDR recordings (v3 play.php pattern).
 * Relative API paths get JWT via ?token= (supported by JwtStrategy).
 */
export function cdrRecordingStreamPath(uniqueid: string): string {
  return `/reports/cdr/recording/${encodeURIComponent(uniqueid)}/play`;
}

export function resolveCdrRecordingPlaybackUrl(
  recordingUrl: string | null | undefined,
  uniqueid?: string | null,
): string | null {
  const path = recordingUrl || (uniqueid ? cdrRecordingStreamPath(uniqueid) : null);
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const apiPath = path.startsWith('/') ? path : `/${path}`;
  const token = localStorage.getItem('accessToken');
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${apiBase}${apiPath}${q}`;
}
