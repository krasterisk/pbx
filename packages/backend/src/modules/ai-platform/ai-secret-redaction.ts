/**
 * Central secret / credential redaction for agent tool args and results.
 * Never accept or echo passwords, API keys, provider secrets in chat/tool payloads.
 */

const SECRET_KEY =
  /pass(word)?|secret|api[_-]?key|token|authorization|credential|private[_-]?key|auth[_-]?trunk/i;

export function redactSecrets<T>(value: T): T {
  return redact(value) as T;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) {
      out[key] = typeof child === 'string' && child.length === 0 ? '' : '[REDACTED]';
      continue;
    }
    out[key] = redact(child);
  }
  return out;
}

export function assertNoSecretArgs(args: Record<string, unknown>): void {
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key) && child != null && child !== '') {
        throw new Error(`SECRET_ARG_FORBIDDEN:${path ? `${path}.` : ''}${key}`);
      }
      walk(child, path ? `${path}.${key}` : key);
    }
  };
  walk(args, '');
}
