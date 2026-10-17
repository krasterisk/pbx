import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Monitor,
  Maximize,
  Minimize,
  WifiOff,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Button } from '@/shared/ui';
import { Progress } from '@/shared/ui/Progress/Progress';
import { useWallboardSSE } from '@/features/callcenter/lib/useWallboardSSE';
import { WallboardKpi } from '@/features/callcenter/ui/WallboardKpi/WallboardKpi';
import type { WallboardKpiTone } from '@/features/callcenter/ui/WallboardKpi/WallboardKpi';
import {
  pushSample,
  bucketHourlyDeltas,
  type CallSample,
} from '@/features/callcenter/model/lib/wallboardChartData';
import {
  selectCcQueues,
  selectCcAgents,
  selectCcConnected,
  selectAvailableAgents,
  selectTotalWaiting,
} from '@/features/callcenter/model/selectors/callCenterSelectors';
import type { AgentStatus } from '@/features/callcenter/model/types/callCenterSchema';
import { rollupSupervisorPeriodKpis } from '@/features/callcenter/lib/supervisorKpiRollup';
import {
  abandonTone,
  availableTone,
  slaTone,
  type KpiTone,
} from '@/features/callcenter/lib/kpiThresholds';
import styles from './CallCenterWallboardPage.module.scss';

const SAMPLE_INTERVAL_MS = 60_000;
const FULLSCREEN_HIDE_MS = 3_000;

const AGENT_STATUSES: AgentStatus[] = [
  'READY',
  'IN_CALL',
  'RINGING',
  'PAUSED',
  'WRAPUP',
  'OFFLINE',
];

function waitingTone(waiting: number): WallboardKpiTone {
  // waiting is a count; use max_wait conceptually as soft/hard pressure bands
  if (waiting === 0) return 'success';
  if (waiting >= 5) return 'destructive';
  if (waiting >= 2) return 'warning';
  return 'default';
}

export function CallCenterWallboardPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Tone thresholds come from the tenant's cc_settings through the display-token stream.
  const { thresholds } = useWallboardSSE(token, Boolean(token));

  const connected = useSelector(selectCcConnected);
  const queues = useSelector(selectCcQueues);
  const agents = useSelector(selectCcAgents);
  const totalWaiting = useSelector(selectTotalWaiting);
  const availableAgents = useSelector(selectAvailableAgents);

  const [samples, setSamples] = useState<CallSample[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Same dictionary as the supervisor strip and the reports: SLA weighted by effective offered
  // (idle queues and short abandons no longer drag it down like the old plain average did).
  const totals = useMemo(() => {
    const period = rollupSupervisorPeriodKpis(queues);
    const talking = queues.reduce((sum, q) => sum + q.talking, 0);
    return {
      talking,
      abandoned: period.abandoned,
      answered: period.answered,
      totalCalls: period.offered,
      effectiveOffered: period.effectiveOffered,
      sla: period.sla,
    };
  }, [queues]);

  // Live chart sampling from SSE snapshot only (no JWT history)
  useEffect(() => {
    if (!token) return;
    const tick = () => {
      const total = queues.reduce((sum, q) => sum + q.calls.total, 0);
      setSamples((prev) => pushSample(prev, { t: Date.now(), total }));
    };
    tick();
    const id = setInterval(tick, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, queues]);

  const chartData = useMemo(() => {
    const buckets = bucketHourlyDeltas(samples);
    return buckets.map((b) => ({
      ...b,
      label: `${String(b.hour).padStart(2, '0')}`,
    }));
  }, [samples]);

  const currentHour = new Date().getHours();

  const statusCounts = useMemo(() => {
    const counts: Record<AgentStatus, number> = {
      READY: 0,
      IN_CALL: 0,
      RINGING: 0,
      PAUSED: 0,
      WRAPUP: 0,
      OFFLINE: 0,
      DIALING: 0,
      CONSULT: 0,
      ACW: 0,
      OUTBOUND_WORK: 0,
    };
    for (const a of agents) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }, [agents]);

  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), FULLSCREEN_HIDE_MS);
  }, []);

  useEffect(() => {
    bumpControls();
    const onMove = () => bumpControls();
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [bumpControls]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }, []);

  if (!token) {
    return (
      <div className={styles.root} data-wallboard="true">
        <div className={styles.empty}>
          <Monitor className={styles.emptyIcon} aria-hidden />
          <h1 className={styles.emptyTitle}>
            {t('callcenter.wallboard.emptyTitle', 'Wallboard для TV')}
          </h1>
          <p className={styles.emptyText}>
            {t(
              'callcenter.wallboard.emptyText',
              'Откройте wallboard по ссылке для TV; создайте её в настройках колл-центра',
            )}
          </p>
        </div>
      </div>
    );
  }

  // No effective traffic is "no data" (neutral), never a red 0 %.
  const slaKpiTone: KpiTone = totals.effectiveOffered > 0 ? slaTone(totals.sla, thresholds) : 'default';
  const waitTone = waitingTone(totalWaiting);
  const availTone = availableTone(availableAgents, thresholds);
  const abdTone = abandonTone(totals.abandoned, totals.effectiveOffered, thresholds);

  return (
    <div className={styles.root} data-wallboard="true">
      {!connected && (
        <div className={styles.banner} role="status">
          <WifiOff size={18} aria-hidden />
          <span>
            {t('callcenter.wallboard.disconnected', 'Соединение потеряно. Переподключение...')}
          </span>
        </div>
      )}

      <div className={connected ? styles.content : styles.contentDimmed}>
        {/* 1. KPI strip */}
        <section className={styles.kpiRow} aria-label={t('callcenter.wallboard.kpi', 'KPI')}>
          <WallboardKpi
            label={t('callcenter.wallboard.kpiWaiting', 'Ожидают')}
            value={totalWaiting}
            tone={waitTone}
            critical={waitTone === 'destructive'}
          />
          <WallboardKpi
            label={t('callcenter.wallboard.kpiAvailable', 'Свободны')}
            value={availableAgents}
            tone={availTone}
            critical={availTone === 'destructive'}
          />
          <WallboardKpi
            label={t('callcenter.wallboard.kpiTalking', 'В разговоре')}
            value={totals.talking}
            tone="default"
          />
          <WallboardKpi
            label={t('callcenter.wallboard.kpiSla', 'SLA')}
            value={`${totals.sla}%`}
            tone={slaKpiTone}
            critical={slaKpiTone === 'destructive'}
          />
          <WallboardKpi
            label={t('callcenter.wallboard.kpiAbandoned', 'Потеряно сегодня')}
            value={totals.abandoned}
            tone={abdTone}
            critical={abdTone === 'destructive'}
          />
          <WallboardKpi
            label={t('callcenter.wallboard.kpiAnswered', 'Отвечено сегодня')}
            value={totals.answered}
            tone="success"
          />
        </section>

        {/* 2. Live calls/hour chart */}
        <section className={styles.chartSection}>
          <h2 className={styles.sectionTitle}>
            {t('callcenter.wallboard.callsPerHour', 'Звонки по часам')}
          </h2>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" fontSize={12} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={12} stroke="var(--color-muted-foreground)" allowDecimals={false} />
                <RechartsTooltip />
                <Bar dataKey="calls" name={t('callcenter.wallboard.calls', 'Звонки')} radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.hour}
                      fill={
                        entry.hour === currentHour
                          ? 'var(--color-primary)'
                          : 'color-mix(in srgb, var(--color-muted-foreground) 50%, transparent)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 3. Agent status strip */}
        <section className={styles.agentsStrip} aria-label={t('callcenter.wallboard.agents', 'Агенты')}>
          {AGENT_STATUSES.map((status) => (
            <div key={status} className={styles.agentChip} data-status={status}>
              <span className={styles.statusDot} data-status={status} />
              <span className={styles.agentLabel}>
                {t(`callcenter.status.${statusKey(status)}`, status)}
              </span>
              <span className={styles.agentCount}>{statusCounts[status]}</span>
            </div>
          ))}
        </section>

        {/* 4. Queue list with SLA bars */}
        <section className={styles.queuesSection}>
          <h2 className={styles.sectionTitle}>
            {t('callcenter.wallboard.queues', 'Очереди')}
          </h2>
          {queues.length === 0 ? (
            <p className={styles.queuesEmpty}>
              {t('callcenter.wallboard.noQueues', 'Нет данных по очередям')}
            </p>
          ) : (
            <ul className={styles.queueList}>
              {queues.map((q) => {
                const hasTraffic = q.calls.total - (q.calls.shortAbandoned ?? 0) > 0;
                const tone = hasTraffic ? slaTone(q.sla, thresholds) : 'info';
                return (
                  <li key={q.name} className={styles.queueRow}>
                    <div className={styles.queueMeta}>
                      <span className={styles.queueName}>{q.displayName || q.name}</span>
                      <span className={styles.queueStats}>
                        <span className={styles.tabular}>
                          {t('callcenter.wallboard.waiting', 'ожид.')} {q.waiting}
                        </span>
                        <span className={styles.tabular}>
                          {t('callcenter.wallboard.talking', 'разг.')} {q.talking}
                        </span>
                        <span className={styles.tabular}>SLA {q.sla}%</span>
                      </span>
                    </div>
                    <Progress value={q.sla} tone={tone} className={styles.slaBar} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Button
        type="button"
        variant="unstyled"
        size="none"
        className={controlsVisible ? styles.fsBtn : styles.fsBtnHidden}
        onClick={toggleFullscreen}
        title={t('callcenter.wallboard.fullscreen', 'Полный экран')}
        aria-label={t('callcenter.wallboard.fullscreen', 'Полный экран')}
      >
        {fullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
      </Button>
    </div>
  );
}

function statusKey(status: AgentStatus): string {
  switch (status) {
    case 'READY': return 'ready';
    case 'IN_CALL': return 'inCall';
    case 'RINGING': return 'ringing';
    case 'PAUSED': return 'paused';
    case 'WRAPUP': return 'wrapup';
    case 'DIALING': return 'dialing';
    case 'CONSULT': return 'consult';
    case 'ACW': return 'acw';
    case 'OFFLINE': return 'offline';
    default: return 'offline';
  }
}
