import { useEffect, useRef, useState } from 'react';
import type { ICcKpiSample } from '@/features/callcenter/model/types/callCenterSchema';

export interface KpiSnapshot {
  waiting: number;
  talking: number;
  freeAgents: number;
  sla: number;
  avgWait: number;
  abandoned: number;
}

export interface UseKpiSamplesOptions {
  maxPoints?: number;
  intervalMs?: number;
}

/**
 * Ring-buffer of KPI samples for supervisor sparklines (session-local trend, no backend history).
 */
export function useKpiSamples(
  kpis: KpiSnapshot,
  { maxPoints = 30, intervalMs = 5000 }: UseKpiSamplesOptions = {},
): ICcKpiSample[] {
  const [samples, setSamples] = useState<ICcKpiSample[]>([]);
  const kpisRef = useRef(kpis);

  useEffect(() => {
    kpisRef.current = kpis;
  }, [kpis]);

  useEffect(() => {
    const pushSample = () => {
      const k = kpisRef.current;
      setSamples(prev => {
        const next = [...prev, { t: Date.now(), ...k }];
        return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
      });
    };

    pushSample();
    const id = window.setInterval(pushSample, intervalMs);
    return () => window.clearInterval(id);
  }, [maxPoints, intervalMs]);

  return samples;
}
