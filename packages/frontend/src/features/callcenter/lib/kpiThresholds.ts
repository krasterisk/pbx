/**
 * KPI tone thresholds shared by the supervisor screen and the TV wallboard.
 *
 * Source of truth is `cc_settings.alert_thresholds`. The defaults mirror the backend
 * (`DEFAULT_ALERT_THRESHOLDS`) so a screen that has not received settings yet and a tenant
 * that never saved any look the same everywhere.
 */
export interface KpiThresholds {
  slaCriticalPct: number;
  maxWaitSec: number;
  abandonRatePct: number;
  agentsAvailableMin: number;
}

export const DEFAULT_KPI_THRESHOLDS: Readonly<KpiThresholds> = {
  slaCriticalPct: 70,
  maxWaitSec: 60,
  abandonRatePct: 10,
  agentsAvailableMin: 1,
};

function pick(raw: Record<string, unknown> | null | undefined, key: string, fallback: number): number {
  const value = raw?.[key];
  // 0 is a legitimate setting (e.g. "no minimum of free agents"); only non-numbers fall back.
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function resolveKpiThresholds(
  alertThresholds: Record<string, unknown> | null | undefined,
): KpiThresholds {
  return {
    slaCriticalPct: pick(alertThresholds, 'sla_critical_pct', DEFAULT_KPI_THRESHOLDS.slaCriticalPct),
    maxWaitSec: pick(alertThresholds, 'max_wait_sec', DEFAULT_KPI_THRESHOLDS.maxWaitSec),
    abandonRatePct: pick(alertThresholds, 'abandon_rate_pct', DEFAULT_KPI_THRESHOLDS.abandonRatePct),
    agentsAvailableMin: pick(alertThresholds, 'agents_available_min', DEFAULT_KPI_THRESHOLDS.agentsAvailableMin),
  };
}

export type KpiTone = 'success' | 'warning' | 'destructive' | 'default';

/** SLA below critical is destructive; within 10 points above it is a warning. */
export function slaTone(sla: number, thresholds: KpiThresholds): 'success' | 'warning' | 'destructive' {
  if (sla < thresholds.slaCriticalPct) return 'destructive';
  if (sla < thresholds.slaCriticalPct + 10) return 'warning';
  return 'success';
}

/** Free agents: below the minimum is destructive, exactly at it is a warning. */
export function availableTone(available: number, thresholds: KpiThresholds): KpiTone {
  if (available < thresholds.agentsAvailableMin) return 'destructive';
  if (available === thresholds.agentsAvailableMin) return 'warning';
  return 'success';
}

/** Abandon rate over the effective offered calls (short abandons excluded by the caller). */
export function abandonTone(abandoned: number, effectiveOffered: number, thresholds: KpiThresholds): KpiTone {
  if (effectiveOffered <= 0) return 'default';
  const rate = (abandoned / effectiveOffered) * 100;
  if (rate >= thresholds.abandonRatePct) return 'destructive';
  if (rate >= thresholds.abandonRatePct * 0.7) return 'warning';
  return 'success';
}
