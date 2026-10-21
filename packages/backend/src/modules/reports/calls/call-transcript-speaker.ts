/** Native SA uses operator/customer; older imports use employee/client. */
export function callTranscriptSpeaker(
  role: string,
): 'client' | 'employee' | 'unknown' {
  if (role === 'operator' || role === 'employee') return 'employee';
  if (role === 'customer' || role === 'client') return 'client';
  return 'unknown';
}
