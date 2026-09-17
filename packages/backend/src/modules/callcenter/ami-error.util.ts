/** Human text from an AMI reject — asterisk-manager often passes a raw response object. */
export function amiFailureMessage(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || '';
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const parts = [o.message, o.Message, o.msg, o.reason];
    const text = parts
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      .join(' ');
    if (text) return text;
    try {
      return JSON.stringify(err);
    } catch {
      return '';
    }
  }
  return String(err);
}

export function isAlreadyQueueMemberError(err: unknown): boolean {
  const msg = amiFailureMessage(err);
  return /already there/i.test(msg) || /already a member/i.test(msg);
}
