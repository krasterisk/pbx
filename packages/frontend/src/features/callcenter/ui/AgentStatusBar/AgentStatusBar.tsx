import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { HStack, Text } from '@/shared/ui';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useGetAgentKpiQuery } from '@/shared/api/endpoints/callCenterApi';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import {
  agentDisplayName,
  agentStatusLabel,
  agentStatusColorFamily,
  queueDisplayName,
} from '@/features/callcenter/lib/displayLabels';
import { CallControlBar } from '@/features/callcenter/ui/CallControlBar/CallControlBar';
import type { IAgent, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './AgentStatusBar.module.scss';

export type ActiveCallDirection = 'queue' | 'personal' | 'outbound';

export interface AgentStatusBarActiveCall {
  /** Queue name — indicator shows the queue label when present (D-14). */
  queue?: string;
  callerIdNum?: string;
  callerIdName?: string;
  /** Only consulted when `queue` is empty. Defaults to 'personal'. */
  direction?: ActiveCallDirection;
}

export interface AgentStatusBarCallControls {
  isMuted: boolean;
  isHeld: boolean;
  onMuteToggle: () => void;
  onHoldToggle: () => void;
  onHangup: () => void;
  /** Omit to hide the Transfer button (host has no transfer target yet). */
  onTransferClick?: () => void;
}

export interface AgentStatusBarProps {
  /** null = not logged in / no active shift — renders the Offline pill. */
  agent: IAgent | null;
  queues: IQueueStats[];
  connected: boolean;
  /** Present during an active call — swaps the pill for the informative indicator (D-14). */
  activeCall?: AgentStatusBarActiveCall | null;
  /** Present during an active call — renders the compact CallControlBar inline (D-03). */
  callControls?: AgentStatusBarCallControls;
  className?: string;
}

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Operator cockpit status bar (D-03/D-11/D-12/D-13/D-14): full 9-status pill
 * with a live mm:ss timer since the last status change, dual shift·day KPI
 * group fed by getAgentKpi + agentKpiUpdate SSE deltas, and — during a call —
 * an informative active-call indicator with the compact inline call controls.
 */
export function AgentStatusBar({
  agent,
  queues,
  connected,
  activeCall,
  callControls,
  className,
}: AgentStatusBarProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  // agentStatusLabel expects a plain (key, fallback) => string signature —
  // i18next's TFunction overloads don't structurally match it directly.
  const tLabel = (key: string, fallback = ''): string => t(key, fallback);

  // Own dual shift/day KPI counters — server-authoritative (T-09-04-01).
  // Kept fresh by the agentKpiUpdate SSE delta invalidating the AgentKpi tag;
  // never recomputed client-side from raw call events.
  const { data: kpi } = useGetAgentKpiQuery(undefined, { skip: !agent });

  // Live status timer (D-14). No server-side "status changed at" timestamp
  // exists on IAgent yet, so track elapsed time client-side since the status
  // value last changed — resets whenever `agent.status` transitions.
  const status = agent?.status;
  const statusStartRef = useRef<number>(Date.now());
  const prevStatusRef = useRef<string | undefined>(status);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (prevStatusRef.current !== status) {
      prevStatusRef.current = status;
      statusStartRef.current = Date.now();
      setElapsed(0);
    }
  }, [status]);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - statusStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const inCall = !!activeCall;
  const colorFamily = agent ? agentStatusColorFamily(agent.status) : 'muted';
  const pillColorClass = styles[`pill_${colorFamily}`] || styles.pill_muted;

  const activeCallTag = (() => {
    if (!activeCall) return '';
    if (activeCall.queue) return queueDisplayName(activeCall.queue, queues);
    const direction = activeCall.direction || 'personal';
    return direction === 'outbound'
      ? t('callcenter.statusBar.outbound', 'Outbound')
      : t('callcenter.statusBar.personal', 'Personal');
  })();

  const activeCallCaller = activeCall
    ? (activeCall.callerIdName || activeCall.callerIdNum || t('callcenter.agent.unknown', 'Unknown'))
    : '';

  return (
    <div className={`${styles.bar}${className ? ` ${className}` : ''}`} data-testid="agent-status-bar">
      {inCall ? (
        <div className={styles.activeCallIndicator}>
          <span className={styles.activeCallTag}>{activeCallTag}</span>
          <Text className={styles.activeCallCaller}>{activeCallCaller}</Text>
        </div>
      ) : (
        <div className={`${styles.pill} ${pillColorClass}`}>
          <span className={styles.pillDot} />
          <Text className={styles.pillLabel}>
            {agent ? agentStatusLabel(agent.status, tLabel) : t('callcenter.status.offline', 'Offline')}
          </Text>
          {agent?.pauseReason && (
            <Text variant="muted" className={styles.pauseReason}>({agent.pauseReason})</Text>
          )}
        </div>
      )}

      {agent && (
        <Text className={styles.agentName}>
          {agentDisplayName(agent)}
          <span className={styles.agentExt}>({interfaceToExtension(agent.interface)})</span>
        </Text>
      )}

      {agent && (
        <Text className={styles.statusTimer}>
          <Clock className="w-3.5 h-3.5 inline mr-1" />
          {formatMmSs(elapsed)}
        </Text>
      )}

      {agent?.queues && agent.queues.length > 0 && !isMobile && (
        <div className={styles.queueChips}>
          {agent.queues.map((q) => (
            <span key={q} className={styles.queueChip} title={q}>
              {queueDisplayName(q, queues)}
            </span>
          ))}
        </div>
      )}

      {inCall && callControls && (
        <CallControlBar
          variant="compact"
          isMuted={callControls.isMuted}
          isHeld={callControls.isHeld}
          onMuteToggle={callControls.onMuteToggle}
          onHoldToggle={callControls.onHoldToggle}
          onHangup={callControls.onHangup}
          onTransferClick={callControls.onTransferClick}
          className={styles.inlineControls}
        />
      )}

      <div className={styles.barRight}>
        <HStack gap="12" className={styles.kpiGroup}>
          <KpiCounter
            label={t('callcenter.kpi.answered', 'Answered')}
            shift={kpi?.answered.shift ?? 0}
            day={kpi?.answered.day ?? 0}
          />
          <KpiCounter
            label={t('callcenter.kpi.made', 'Made')}
            shift={kpi?.made.shift ?? 0}
            day={kpi?.made.day ?? 0}
          />
          <KpiCounter
            label={t('callcenter.kpi.missed', 'Missed')}
            shift={kpi?.missed.shift ?? 0}
            day={kpi?.missed.day ?? 0}
          />
        </HStack>

        {agent?.loginTime && !isMobile && (
          <Text className={styles.sessionTimer}>
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            {t('callcenter.agent.session', 'Session')}: {agent.callsTaken} {t('callcenter.agent.calls', 'calls')}
          </Text>
        )}

        <div className={`${styles.connectionDot} ${connected ? styles.connectionOnline : styles.connectionOffline}`} />
      </div>
    </div>
  );
}

function KpiCounter({ label, shift, day }: { label: string; shift: number; day: number }) {
  return (
    <div className={styles.kpiCounter}>
      <Text className={styles.kpiValue}>{shift} · {day}</Text>
      <Text className={styles.kpiLabel}>{label}</Text>
    </div>
  );
}
