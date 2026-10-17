/**
 * Supervisor KPI strip rollup — live snapshot vs weighted reporting-day metrics.
 *
 * Live (now): waiting / talking / freeAgents from RAM.
 * Period: SLA / ASA / answered / abandoned weighted by offered|answered —
 * never average empty queues as SLA 100%.
 */
import type { IAgent, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';
import type { IShiftPolicy } from '@/shared/api/endpoints/callCenterApi';

export interface SupervisorLiveKpis {
  waiting: number;
  talking: number;
  freeAgents: number;
  totalAgents: number;
}

export interface SupervisorPeriodKpis {
  answered: number;
  abandoned: number;
  /** Weighted SLA % (1 decimal, like reports); 0 when no effective offered calls in the period. */
  sla: number;
  /** Weighted ASA seconds; 0 when no answered calls. */
  avgWait: number;
  /** Offered including short abandons. */
  offered: number;
  /** Offered minus short abandons: the SLA / abandon-rate denominator. 0 means "no data", not "bad". */
  effectiveOffered: number;
}

export interface SupervisorKpiRollup {
  live: SupervisorLiveKpis;
  period: SupervisorPeriodKpis;
}

export type SupervisorKpiPeriodMode = 'calendar_day' | 'business_day';

export interface SupervisorKpiPeriodMeta {
  mode: SupervisorKpiPeriodMode;
  boundaryTime: string;
}

export function rollupSupervisorLiveKpis(
  agents: Pick<IAgent, 'status' | 'phoneOnline'>[],
  queues: Pick<IQueueStats, 'waiting' | 'talking'>[],
): SupervisorLiveKpis {
  return {
    waiting: queues.reduce((s, q) => s + (q.waiting || 0), 0),
    talking: queues.reduce((s, q) => s + (q.talking || 0), 0),
    freeAgents: agents.filter((a) => a.status === 'READY' && a.phoneOnline !== false).length,
    totalAgents: agents.length,
  };
}

/**
 * Combine per-queue figures with the SAME dictionary the reports use:
 * - SLA is weighted by effective offered = total - shortAbandoned (the SLA denominator);
 * - ASA is weighted by handled (answered).
 * Queues with no effective offered calls drop out of SLA; no handled calls drop out of ASA.
 * Never a plain average of queue SLAs (an idle queue would drag the total down).
 */
export function rollupSupervisorPeriodKpis(
  queues: Array<Pick<IQueueStats, 'sla' | 'avgWait' | 'calls'>>,
): SupervisorPeriodKpis {
  let offered = 0;
  let effectiveOffered = 0;
  let answered = 0;
  let abandoned = 0;
  let slaWeighted = 0;
  let waitWeighted = 0;

  for (const q of queues) {
    const total = Math.max(0, q.calls?.total ?? 0);
    const short = Math.max(0, q.calls?.shortAbandoned ?? 0);
    const o = Math.max(0, total - short);
    const a = Math.max(0, q.calls?.answered ?? 0);
    const lost = Math.max(0, q.calls?.abandoned ?? 0);
    offered += total;
    answered += a;
    abandoned += lost;
    if (o > 0) slaWeighted += (q.sla || 0) * o;
    effectiveOffered += o;
    if (a > 0) waitWeighted += (q.avgWait || 0) * a;
  }

  return {
    answered,
    abandoned,
    offered,
    effectiveOffered,
    sla: effectiveOffered > 0 ? Math.round((slaWeighted / effectiveOffered) * 10) / 10 : 0,
    avgWait: answered > 0 ? Math.round(waitWeighted / answered) : 0,
  };
}

export function rollupSupervisorKpis(
  agents: Pick<IAgent, 'status' | 'phoneOnline'>[],
  queues: IQueueStats[],
): SupervisorKpiRollup {
  return {
    live: rollupSupervisorLiveKpis(agents, queues),
    period: rollupSupervisorPeriodKpis(queues),
  };
}

/** Derive period chip from tenant shift_policy (same rules as backend util). */
export function resolveSupervisorKpiPeriodMeta(
  policy: Partial<IShiftPolicy> | null | undefined,
): SupervisorKpiPeriodMeta {
  const eod = String(policy?.eod_time || '00:00').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(eod);
  const h = m ? Number(m[1]) : 0;
  const min = m ? Number(m[2]) : 0;
  const valid = Boolean(m) && h <= 23 && min <= 59;
  if (policy?.close_at_eod && valid && !(h === 0 && min === 0)) {
    return { mode: 'business_day', boundaryTime: eod };
  }
  return { mode: 'calendar_day', boundaryTime: '00:00' };
}
