import { useSearchParams } from 'react-router-dom';

/** Namespaced keys coexist with the campaign workspace's own `tab`. */
export function useReportSearch() {
  const [params, setParams] = useSearchParams();
  const read = (key: string) => params.get(`ac_${key}`);
  const write = (changes: Record<string, string | null>) => setParams((current) => {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(`ac_${key}`); else next.set(`ac_${key}`, value);
    }
    return next;
  }, { replace: true });
  return { read, write };
}
export function validReportDate(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}
