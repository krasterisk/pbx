import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { HStack, Text, Button, Tooltip, Switch } from '@/shared/ui';
import { useGetAgentKpiQuery } from '@/shared/api/endpoints/callCenterApi';
import {
  agentStatusLabel,
  agentStatusColorFamily,
  queueDisplayName,
  formatPauseReason,
} from '@/features/callcenter/lib/displayLabels';
import { CallControlBar } from '@/features/callcenter/ui/CallControlBar/CallControlBar';
import type { KpiDisplayMode } from '@/features/callcenter/lib/agentPanelPrefs';
import type { IAgent, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './AgentStatusBar.module.scss';

export type ActiveCallDirection = 'queue' | 'personal' | 'outbound';

export interface AgentStatusBarActiveCall {
  queue?: string;
  callerIdNum?: string;
  callerIdName?: string;
  direction?: ActiveCallDirection;
}

export interface AgentStatusBarCallControls {
  isMuted: boolean;
  isHeld: boolean;
  /** SIP mode: Hold stays visible but inactive (use device hold). */
  holdDisabled?: boolean;
  onMuteToggle: () => void;
  onHoldToggle: () => void;
  onHangup: () => void;
  onTransferClick?: () => void;
}

export interface AgentStatusBarShiftActions {
  onPause?: () => void;
  onResume?: () => void;
  onEndShift?: () => void;
  onStartShift?: () => void;
  /**
   * Toggle queue-paused outbound work (checked = OUTBOUND_WORK).
   * Called with the desired next state.
   */
  onOutboundWorkChange?: (active: boolean) => void;
  /** Whether outbound-work mode is currently active. */
  outboundWorkActive?: boolean;
  /** Show the outbound-work toggle (READY / PAUSED / OUTBOUND_WORK). */
  showOutboundWork?: boolean;
  pauseLabel?: string;
  showPause?: boolean;
  showResume?: boolean;
  isLoggedIn?: boolean;
}

export interface AgentStatusBarProps {
  agent: IAgent | null;
  queues: IQueueStats[];
  /** Panel KPI period preference (day / shift / both). */
  kpiDisplay?: KpiDisplayMode;
  activeCall?: AgentStatusBarActiveCall | null;
  callControls?: AgentStatusBarCallControls;
  shiftActions?: AgentStatusBarShiftActions;
  /** Optional extra chrome on the right (kept for flexibility). */
  trailing?: ReactNode;
  className?: string;
}

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function KpiCounter({
  label,
  shift,
  day,
  mode,
}: {
  label: string;
  shift: number;
  day: number;
  mode: KpiDisplayMode;
}) {
  const { t } = useTranslation();
  const value = (() => {
    if (mode === 'shift') {
      return <span title={t('callcenter.kpi.shift', 'This shift')}>{shift}</span>;
    }
    if (mode === 'day') {
      return <span title={t('callcenter.kpi.day', 'Since midnight')}>{day}</span>;
    }
    return (
      <>
        <span title={t('callcenter.kpi.shift', 'This shift')}>{shift}</span>
        <span className={styles.kpiSep}>·</span>
        <span title={t('callcenter.kpi.day', 'Since midnight')}>{day}</span>
      </>
    );
  })();

  return (
    <div
      className={styles.kpiCounter}
      title={
        mode === 'both'
          ? t('callcenter.kpi.hint', 'Left: this shift · Right: since midnight')
          : mode === 'shift'
            ? t('callcenter.kpi.shift', 'This shift')
            : t('callcenter.kpi.day', 'Since midnight')
      }
    >
      <Text className={styles.kpiValue}>{value}</Text>
      <Text className={styles.kpiLabel}>{label}</Text>
    </div>
  );
}

/**
 * Compact operator status strip: status pill + timer + KPI + shift actions +
 * in-call controls. Softphone/chat live in the page header.
 */
export function AgentStatusBar({
  agent,
  queues,
  kpiDisplay = 'shift',
  activeCall,
  callControls,
  shiftActions,
  trailing,
  className,
}: AgentStatusBarProps) {
  const { t } = useTranslation();
  const tLabel = (key: string, fallback = ''): string => t(key, fallback);
  const { data: kpi } = useGetAgentKpiQuery(undefined, { skip: !agent });

  const status = agent?.status;
  const serverSinceMs = (() => {
    if (!agent?.statusSince) return NaN;
    const ms = Date.parse(agent.statusSince);
    return Number.isFinite(ms) ? ms : NaN;
  })();
  const fallbackStartRef = useRef<number>(Date.now());
  const prevStatusRef = useRef<string | undefined>(status);
  const [now, setNow] = useState(() => Date.now());

  if (prevStatusRef.current !== status) {
    prevStatusRef.current = status;
    fallbackStartRef.current = Date.now();
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startMs = Number.isFinite(serverSinceMs) ? serverSinceMs : fallbackStartRef.current;
  const elapsed = Math.max(0, Math.floor((now - startMs) / 1000));

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

  const shiftActionsNode = shiftActions && !callControls ? (
    <div className={styles.shiftActions}>
      {!shiftActions.isLoggedIn && shiftActions.onStartShift && (
        <Button size="sm" onClick={shiftActions.onStartShift}>
          {t('callcenter.softphone.startShift')}
        </Button>
      )}
      {shiftActions.isLoggedIn && shiftActions.showOutboundWork && shiftActions.onOutboundWorkChange && (
        <Tooltip
          content={shiftActions.outboundWorkActive
            ? t('callcenter.agent.leaveOutboundWorkHint', 'Return to waiting for inbound calls')
            : t('callcenter.agent.outboundWorkHint', 'Pause queues and work on outbound calls')}
        >
          <label className={styles.outboundToggle}>
            <Switch
              checked={!!shiftActions.outboundWorkActive}
              onCheckedChange={shiftActions.onOutboundWorkChange}
              aria-label={t('callcenter.agent.outboundWork', 'Outbound work')}
            />
            <span className={styles.outboundToggleLabel}>
              {t('callcenter.agent.outboundWork', 'Outbound work')}
            </span>
          </label>
        </Tooltip>
      )}
      {shiftActions.isLoggedIn && shiftActions.showPause && shiftActions.onPause && (
        <Tooltip content={t('callcenter.agent.pauseHint', 'Pause yourself in all queues')}>
          <Button variant="outline" size="sm" onClick={shiftActions.onPause}>
            {shiftActions.pauseLabel || t('callcenter.agent.pause', 'Pause')}
          </Button>
        </Tooltip>
      )}
      {shiftActions.isLoggedIn && shiftActions.showResume && shiftActions.onResume && (
        <Tooltip content={t('callcenter.agent.unpauseHint', 'Return to waiting for calls')}>
          <Button variant="outline" size="sm" onClick={shiftActions.onResume}>
            {t('callcenter.agent.unpause', 'Resume')}
          </Button>
        </Tooltip>
      )}
      {shiftActions.isLoggedIn && shiftActions.onEndShift && (
        <Tooltip content={t('callcenter.agent.endShiftHint', 'Log out of all queues and end the shift')}>
          <Button variant="destructive" size="sm" onClick={shiftActions.onEndShift}>
            {t('callcenter.softphone.endShift')}
          </Button>
        </Tooltip>
      )}
    </div>
  ) : null;

  return (
    <div
      className={`${styles.bar}${callControls ? ` ${styles.barWithControls}` : ''}${className ? ` ${className}` : ''}`}
      data-testid="agent-status-bar"
    >
      <div className={styles.barMain}>
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
            {agent?.pauseReason && agent.status !== 'OUTBOUND_WORK' && (
              <Text variant="muted" className={styles.pauseReason}>
                ({formatPauseReason(agent.pauseReason, t)})
              </Text>
            )}
          </div>
        )}

        {agent && (
          <Text className={styles.statusTimer} title={t('callcenter.statusBar.statusDuration', 'Time in current status')}>
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            {formatMmSs(elapsed)}
          </Text>
        )}

        {agent && (
          <HStack
            gap="12"
            className={styles.kpiGroup}
            title={
              kpiDisplay === 'both'
                ? t('callcenter.kpi.hint', 'Left: this shift · Right: since midnight')
                : kpiDisplay === 'shift'
                  ? t('callcenter.kpi.shift', 'This shift')
                  : t('callcenter.kpi.day', 'Since midnight')
            }
          >
            <KpiCounter
              label={t('callcenter.kpi.answered', 'Answered')}
              shift={Math.max(agent.callsTaken ?? 0, kpi?.answered.shift ?? 0)}
              day={Math.max(agent.kpiDay?.answered ?? 0, kpi?.answered.day ?? 0)}
              mode={kpiDisplay}
            />
            <KpiCounter
              label={t('callcenter.kpi.made', 'Made')}
              shift={Math.max(agent.callsMade ?? 0, kpi?.made.shift ?? 0)}
              day={Math.max(agent.kpiDay?.made ?? 0, kpi?.made.day ?? 0)}
              mode={kpiDisplay}
            />
            <KpiCounter
              label={t('callcenter.kpi.missed', 'Missed')}
              shift={Math.max(agent.callsMissed ?? 0, kpi?.missed.shift ?? 0)}
              day={Math.max(agent.kpiDay?.missed ?? 0, kpi?.missed.day ?? 0)}
              mode={kpiDisplay}
            />
          </HStack>
        )}

        {(shiftActionsNode || trailing) && (
          <div className={styles.barRight}>
            {shiftActionsNode}
            {trailing}
          </div>
        )}
      </div>

      {inCall && callControls && (
        <div className={styles.controlsRow}>
          <CallControlBar
            variant="compact"
            isMuted={callControls.isMuted}
            isHeld={callControls.isHeld}
            holdDisabled={callControls.holdDisabled}
            onMuteToggle={callControls.onMuteToggle}
            onHoldToggle={callControls.onHoldToggle}
            onHangup={callControls.onHangup}
            onTransferClick={callControls.onTransferClick}
            className={styles.inlineControls}
          />
        </div>
      )}
    </div>
  );
}
