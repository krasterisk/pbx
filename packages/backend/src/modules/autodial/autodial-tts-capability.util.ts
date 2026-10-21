interface SpeechProviderMetadata {
  uid: number;
  name: string;
  is_global: boolean;
  vendor?: string;
  defaults?: unknown;
}

/** Public campaign controls need no connection details or provider credentials. */
export function autodialTtsCapability(row: SpeechProviderMetadata): {
  uid: number; name: string; is_global: boolean; type: 'google' | 'yandex' | 'custom';
  settings: Record<string, string | number>;
} {
  const defaults = row.defaults && typeof row.defaults === 'object' && !Array.isArray(row.defaults)
    ? row.defaults as Record<string, unknown> : {};
  const settings: Record<string, string | number> = {};
  for (const key of ['speed', 'speaking_rate'] as const) {
    const raw = defaults[key];
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (typeof value !== 'number' && !(typeof value === 'string' && value.length <= 32 && /^\d+(?:\.\d+)?$/.test(value))) continue;
    const rate = Number(value);
    if (Number.isFinite(rate) && rate > 0 && rate <= 10) settings[key] = value;
  }
  return { uid: row.uid, name: row.name, is_global: row.is_global,
    type: row.vendor === 'google' || row.vendor === 'yandex' ? row.vendor : 'custom', settings };
}
