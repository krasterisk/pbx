import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { HStack, Text, Button, Tooltip, Switch, Label } from '@/shared/ui';
import { useGetAgentKpiQuery } from '@/shared/api/endpoints/callCenterApi';
import {
  callerDisplayName,
  agentStatusLabel,
  agentStatusColorFamily,
  queueDisplayName,
  formatPauseReason,
  formatStatusElapsed,
} from '@/features/callcenter/lib/displayLabels';
import { CallControlBar } from '@/features/callcenter/ui/CallControlBar/CallControlBar';
import type { KpiDisplayMode } from '@/features/callcenter/lib/agentPanelPrefs';
import { pauseLimitState, type PauseLimitLevel } from '@/features/callcenter/lib/pauseLimit';
import type { IAgent, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './AgentStatusBar.module.scss';
import { CcMetricLabel } from '../CcMetricLabel/CcMetricLabel';

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
  muteDisabled?: boolean;
  onMuteToggle: () => void;
  onHoldToggle: () => void;
  onHangup: () => void;
  onTransferClick?: () => void;
  /** Own active call: enables park / queue-transfer / zombie-reset in the same bar. */
  uniqueid?: string;
  isZombie?: boolean;
  /** Hotkey hints shown in the button tooltips (U2.4). */
  hotkeyHints?: Partial<Record<'mute' | 'hold' | 'transfer' | 'hangup', string>>;
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
  /** Max duration (minutes) of the current pause reason; 0 / undefined = unlimited. */
  pauseLimitMin?: number;
  callControls?: AgentStatusBarCallControls;
  shiftActions?: AgentStatusBarShiftActions;
  /** Optional extra chrome on the right (kept for flexibility). */
  trailing?: ReactNode;
  className?: string;
}

/** One number per KPI (U2.6): the chosen period is the value, the other one is in the tooltip. */
function KpiCounter({
  label,
  metric,
  shift,
  day,
  mode,
}: {
  label: string;
  metric: string;
  shift: number;
  day: number;
  mode: KpiDisplayMode;
}) {
  const { t } = useTranslation();
  const primary = mode === 'day' ? day : shift;
  const title = mode === 'day'
    ? t('callcenter.kpi.tooltipDay', 'Since midnight: {{day}} · this shift: {{shift}}', { day, shift })
    : t('callcenter.kpi.tooltipShift', 'This shift: {{shift}} · since midnight: {{day}}', { day, shift });

  return (
    <div className={styles.kpiCounter} title={title} data-testid={`kpi-${label}`}>
      <Text className={styles.kpiValue}>{primary}</Text>
      <Text className={styles.kpiLabel}><CcMetricLabel metric={metric} period={title}>{label}</CcMetricLabel></Text>
    </div>
  );
}

/** Pause timer against the reason limit: "07:12 of 30:00", warning one minute before, then "over limit +2:10". */
function PauseLimitTimer({ elapsed, maxDurationMin }: { elapsed: number; maxDurationMin: number }) {
  const { t } = useTranslation();
  const state = pauseLimitState(elapsed, maxDurationMin);
  const announced = useRef<PauseLimitLevel>('none');
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (state.level === announced.current) return;
    announced.current = state.level;
    if (state.level === 'warn') {
      setAnnouncement(t('callcenter.agent.pauseLimitWarn', 'Pause limit ends in one minute'));
    } else if (state.level === 'over') {
      setAnnouncement(t('callcenter.agent.pauseLimitOver', 'Pause limit exceeded'));
    } else {
      setAnnouncement('');
    }
  }, [state.level, t]);

  const text = state.level === 'over'
    ? t('callcenter.agent.pauseOver', 'over limit +{{over}}', { over: formatStatusElapsed(state.overSec) })
    : t('callcenter.agent.pauseOf', '{{elapsed}} of {{limit}}', {
      elapsed: formatStatusElapsed(elapsed),
      limit: formatStatusElapsed(state.limitSec),
    });

  return (
    <Text
      className={`${styles.statusTimer}${state.level === 'warn' ? ` ${styles.timerWarn}` : ''}${state.level === 'over' ? ` ${styles.timerOver}` : ''}`}
      title={t('callcenter.statusBar.statusDuration', 'Time in current status')}
      data-testid="pause-limit-timer"
      data-level={state.level}
    >
      <Clock className="w-3.5 h-3.5 inline mr-1" />
      {text}
      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    </Text>
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
  pauseLimitMin,
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
    ? (callerDisplayName(activeCall.callerIdName) || callerDisplayName(activeCall.callerIdNum) || t('callcenter.agent.unknown', 'Unknown'))
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
          <Label className={styles.outboundToggle}>
            <Switch
              checked={!!shiftActions.outboundWorkActive}
              onCheckedChange={shiftActions.onOutboundWorkChange}
              aria-label={t('callcenter.agent.outboundWork', 'Outbound work')}
            />
            <span className={styles.outboundToggleLabel}>
              {t('callcenter.agent.outboundWork', 'Outbound work')}
            </span>
          </Label>
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
              {agent?.status === 'READY' && agent.phoneOnline === false
                ? t('callcenter.status.phoneUnavailable', 'Phone unavailable · cannot receive calls')
                : agent ? agentStatusLabel(agent.status, tLabel) : t('callcenter.status.offline', 'Offline')}
            </Text>
            {agent?.pauseReason && agent.status !== 'OUTBOUND_WORK' && formatPauseReason(agent.pauseReason, t) && (
              <Text variant="muted" className={styles.pauseReason}>
                ({formatPauseReason(agent.pauseReason, t)})
              </Text>
            )}
          </div>
        )}

        {agent && (agent.status === 'PAUSED' && (pauseLimitMin ?? 0) > 0 ? (
          <PauseLimitTimer elapsed={elapsed} maxDurationMin={pauseLimitMin ?? 0} />
        ) : (
          <Text className={styles.statusTimer} title={t('callcenter.statusBar.statusDuration', 'Time in current status')}>
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            {formatStatusElapsed(elapsed)}
          </Text>
        ))}

        {agent && (
          <HStack
            gap="12"
            className={styles.kpiGroup}
            role="group"
            aria-label={t('callcenter.kpi.groupLabel', 'Shift counters')}
          >
            <KpiCounter
              metric="answered"
              label={t('callcenter.kpi.answered', 'Answered')}
              shift={Math.max(agent.callsTaken ?? 0, kpi?.answered.shift ?? 0)}
              day={Math.max(agent.kpiDay?.answered ?? 0, kpi?.answered.day ?? 0)}
              mode={kpiDisplay}
            />
            <KpiCounter
              metric="outbound"
              label={t('callcenter.kpi.made', 'Made')}
              shift={Math.max(agent.callsMade ?? 0, kpi?.made.shift ?? 0)}
              day={Math.max(agent.kpiDay?.made ?? 0, kpi?.made.day ?? 0)}
              mode={kpiDisplay}
            />
            <KpiCounter
              metric="missedAttempt"
              label={t('callcenter.kpi.missedOffers', 'Missed offers')}
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
            variant="full"
            uniqueid={callControls.uniqueid}
            isZombie={callControls.isZombie}
            hotkeyHints={callControls.hotkeyHints}
            isMuted={callControls.isMuted}
            isHeld={callControls.isHeld}
            holdDisabled={callControls.holdDisabled}
            muteDisabled={callControls.muteDisabled}
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
