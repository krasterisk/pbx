import { useEffect, useRef, useState } from 'react';
import type { ICcKpiSample } from '@/features/callcenter/model/types/callCenterSchema';

export interface KpiSnapshot {
  waiting: number;
  talking: number;
  freeAgents: number;
  sla: number;
  avgWait: number;
  abandoned: number;
  answered?: number;
}

export interface UseKpiSamplesOptions {
  maxPoints?: number;
}

export function sameKpiSnapshot(a: KpiSnapshot, b: KpiSnapshot): boolean {
  return a.waiting === b.waiting
    && a.talking === b.talking
    && a.freeAgents === b.freeAgents
    && a.sla === b.sla
    && a.avgWait === b.avgWait
    && a.abandoned === b.abandoned
    && (a.answered ?? 0) === (b.answered ?? 0);
}

/**
 * Ring-buffer of KPI samples for supervisor sparklines.
 * Event-driven: records a point only when live KPIs change (SSE / AMI).
 * No wall-clock interval — polling here would re-render the whole dashboard.
 */
export function useKpiSamples(
  kpis: KpiSnapshot,
  { maxPoints = 30 }: UseKpiSamplesOptions = {},
): ICcKpiSample[] {
  const [samples, setSamples] = useState<ICcKpiSample[]>([]);
  const lastRef = useRef<KpiSnapshot | null>(null);

  useEffect(() => {
    if (lastRef.current && sameKpiSnapshot(lastRef.current, kpis)) return;
    lastRef.current = kpis;
    setSamples((prev) => {
      const next = [...prev, { t: Date.now(), ...kpis }];
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
    });
  }, [kpis, maxPoints]);

  return samples;
}
