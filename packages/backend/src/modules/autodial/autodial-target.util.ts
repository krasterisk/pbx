function safeTarget(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (/[\s()[\]{}$,;?\\/]/.test(raw)) throw new Error('AC_SCENARIO_INVALID_TARGET');
  return raw;
}

/** Public catalog values and saved legacy realtime names have distinct spellings. */
export function autodialQueueTarget(params: Record<string, unknown>, tenant: number): string {
  const target = params.target as { source?: string; value?: unknown } | undefined;
  const legacy = params.queue ?? params.queue_name;
  const raw = safeTarget(legacy ?? (target?.source === 'fixed' ? target.value : ''));
  if (!raw) return '';
  const scoped = /^q(.+)_(\d+)$/.exec(raw);
  if (scoped) {
    if (Number(scoped[2]) !== tenant) throw new Error('AC_SCENARIO_FOREIGN_TARGET');
    return raw;
  }
  return legacy !== undefined ? raw : `q${raw}_${tenant}`;
}

export function autodialExtensionTarget(params: Record<string, unknown>, tenant: number): { id: string; dial: string } {
  const target = params.target as { source?: string; value?: unknown } | undefined;
  const raw = safeTarget(params.exten ?? params.extension ?? (target?.source === 'fixed' ? target.value : ''));
  if (!raw) return { id: '', dial: '' };
  const scoped = /^e(w?)(.+)_(\d+)$/.exec(raw);
  if (scoped && Number(scoped[3]) !== tenant) throw new Error('AC_SCENARIO_FOREIGN_TARGET');
  const number = scoped?.[2] ?? raw;
  const primary = `e${number}_${tenant}`;
  if (scoped && params.webrtc === undefined) return { id: raw, dial: `PJSIP/${raw}` };
  return { id: primary, dial: params.webrtc === false ? `PJSIP/${primary}` : `PJSIP/${primary}&PJSIP/ew${number}_${tenant}` };
}
