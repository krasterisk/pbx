export interface TestCallCommand { idempotency_key: string; contact_uid: number; expected_revision: number }

/** Only identifiers are retained. An unknown response must never mint another call. */
export function readTestCallCommand(key: string | null): TestCallCommand | null {
  if (!key) return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return value && /^[A-Za-z0-9_-]{8,80}$/.test(value.idempotency_key)
      && Number.isSafeInteger(value.contact_uid) && value.contact_uid > 0
      && Number.isSafeInteger(value.expected_revision) && value.expected_revision >= 0 ? value : null;
  } catch { return null; }
}

export function writeTestCallCommand(key: string | null, value: TestCallCommand | null) {
  if (!key) return;
  try { if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key); }
  catch { /* The mounted panel still retains the request identity in memory. */ }
}
