import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CC_METRIC_DEFINITIONS, type CcMetricId } from '@krasterisk/shared';
import { Tooltip } from '@/shared/ui';

const aliases: Record<string, CcMetricId> = {
  totalCalls: 'offered', answered: 'handled', handled: 'handled', slaPct: 'sla', sla: 'sla',
  abandonRatePct: 'abandon', shortAbandoned: 'shortAbandon', avgWait: 'asa', avgWaitSec: 'asa',
  ahtSec: 'aht', avgHandleSec: 'aht',   occupancyPct: 'occupancy',
};
const extra: Record<string, string> = {
  queueFree: 'Members of this queue who are available for a call, including people outside your watchlist. A person in several queues can appear in each queue count.',
  waiting: 'Callers waiting for an operator in the selected queues right now.',
  talking: 'Calls currently connected to operators in the selected queues.',
  free: 'Operators in your watchlist who are ready and whose phones are reachable. The selected queue filter applies.',
  totalAgents: 'People in your watchlist, including those who have not started a shift. The current filters apply.',
  abandoned: 'Unique calls where the caller left the queue before an operator answered. Short abandons are included in this count.',
  outbound: 'Outbound calls answered by the other party; dialing attempts without an answer are excluded.',
  missedAttempt: 'Offers you did not answer. Repeated offers can belong to one caller; this is different from the callback work list.',
  waitTime: 'Time in the queue before an answer or the caller leaving. This is not hold during a conversation.',
  holdTime: 'Time the answered conversation spent on hold. Waiting before the first answer is excluded.',
  talkTime: 'Time after the operator answered and before the call ended.',
  avgTalkSec: 'Average duration of answered conversations in the selected period.',
  answerRatePct: 'Handled calls ÷ (handled + ring-no-answer offers).',
  ready: 'Operators ready for incoming queue calls with a reachable phone.',
  longestWait: 'Longest current wait among callers still in the queue, in seconds. It increases until the call is answered or leaves.',
  paused: 'Operators on a break; they do not receive incoming queue calls.',
  wrapup: 'Operators completing work after a conversation; new queue calls wait until wrap-up ends.',
  offline: 'Operators who have not started a shift. A phone being unreachable is shown separately.',
  utilizationPct: 'Busy time ÷ time on shift. Busy is talk, hold, wrap-up, dialing and consultation.',
  pauseSharePct: 'Pause time ÷ time on shift.',
  callsPerHour: 'Handled calls ÷ hours on shift. Hidden when a queue filter is on, because shift time is operator-wide.',
  rnaCount: 'Queue offers this person did not answer.',
  shortCallPct: 'Handled calls shorter than the short-call threshold ÷ handled calls.',
  readySec: 'Time in the Ready state: waiting for a call, not idle as a violation.',
  ahtSec: 'Average handle time = (talk including hold + wrap-up) ÷ handled calls.',
};

/** Shared metric dictionary plus scope-specific live-counter definitions. */
export function CcMetricLabel({ metric, children, period, sample }: {
  metric: string; children: ReactNode; period?: string; sample?: number;
}) {
  const { t, i18n } = useTranslation();
  const id = aliases[metric] ?? (metric in CC_METRIC_DEFINITIONS ? metric as CcMetricId : undefined);
  const definition = id ? CC_METRIC_DEFINITIONS[id] : undefined;
  const hint = definition
    ? ((i18n?.resolvedLanguage ?? i18n?.language ?? 'en').startsWith('ru') ? definition.formulaRu : definition.formulaEn)
    : extra[metric] ? t(`callcenter.metricHelp.${metric}`, extra[metric]) : undefined;
  if (!hint) return <>{children}</>;
  const context = [period, sample !== undefined ? t('callcenter.metricHelp.sample', { defaultValue: 'Calls in sample: {{count}}', count: sample }) : ''].filter(Boolean).join(' · ');
  return <Tooltip content={context ? `${hint}\n${context}` : hint}>
    <span tabIndex={0} className="cursor-help border-b border-dotted border-current outline-offset-2" data-metric-help={metric}>
      {children}
    </span>
  </Tooltip>;
}
