import { cdrRecordingStreamUrl } from '@/shared/lib/cdrRecordingUrl';

/** Load MP3 via authenticated API stream (same-origin, no mixed content). */
export async function fetchCdrRecordingBlob(uniqueid: string): Promise<string | null> {
  const token = localStorage.getItem('accessToken');
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(cdrRecordingStreamUrl(uniqueid), { headers, credentials: 'include' });
  if (!res.ok) {
    return null;
  }

  const blob = await res.blob();
  if (!blob.size) {
    return null;
  }

  return URL.createObjectURL(blob);
}
