export function clientColumnViewKey(tenant: number, actor: number, base: number) {
  return `autodial:client-columns:v1:${tenant}:${actor}:${base}`;
}
export function readHiddenClientColumns(key: string | null): string[] {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > 20000) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.length <= 200 && value.every((id) => typeof id === 'string' && /^(field:[0-9]+|external_id)$/.test(id)) ? value : [];
  } catch { return []; }
}
