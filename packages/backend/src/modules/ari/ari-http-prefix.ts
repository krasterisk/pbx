/** Preserve a legacy Asterisk HTTP prefix without rewriting its configuration. */
export function ariHttpPrefix(value?: string): string {
  const prefix = (value ?? '').replace(/^\/+|\/+$/g, '');
  if (prefix && !/^[A-Za-z0-9_/-]+$/.test(prefix)) throw new Error('Invalid ARI_HTTP_PREFIX');
  return prefix ? `/${prefix}` : '';
}
