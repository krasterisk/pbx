import type { CallsQuery } from '@krasterisk/shared';
export function callsParams(query: CallsQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value])
      params.append(key, String(entry));
  }
  return params;
}
