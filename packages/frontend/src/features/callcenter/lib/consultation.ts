export type ConsultationState = { target: string; phase: 'dialing' | 'connected' | 'transferring' };

/** A REFER's 202 only accepts the request; the NOTIFY sipfrag reports its result. */
export function transferResult(body: string): 'pending' | 'success' | 'failure' {
  const status = Number(body.match(/^SIP\/2\.0\s+(\d{3})/m)?.[1]);
  if (!status || status < 200) return 'pending';
  return status < 300 ? 'success' : 'failure';
}
