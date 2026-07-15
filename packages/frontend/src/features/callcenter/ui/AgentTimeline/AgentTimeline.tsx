import { memo, useMemo } from 'react';
import type { AgentTimelineSegment } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './AgentTimeline.module.scss';

export interface AgentTimelineProps {
  segments: AgentTimelineSegment[];
  date?: string;
  live?: boolean;
  startHour?: number;
  endHour?: number;
}

function segmentClass(state: string): string {
  switch (state) {
    case 'READY':
      return styles.segmentReady;
    case 'IN_CALL':
      return styles.segmentInCall;
    case 'PAUSED':
      return styles.segmentPaused;
    case 'WRAPUP':
      return styles.segmentWrapup;
    case 'HOLD':
      return styles.segmentHold;
    default:
      return styles.segmentOffline;
  }
}

function dayBounds(date: Date, startHour: number, endHour: number) {
  const start = new Date(date);
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(date);
  end.setHours(endHour, 0, 0, 0);
  const span = Math.max(end.getTime() - start.getTime(), 1);
  return { start, end, span };
}

function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * Presentational agent day timeline (D-36 owner — segments built server-side).
 * Reused by supervisor agent detail (07-09) and reports (07-18).
 */
export const AgentTimeline = memo(function AgentTimeline({
  segments,
  date,
  live = false,
  startHour = 0,
  endHour = 24,
}: AgentTimelineProps) {
  const refDate = useMemo(() => {
    if (date) return new Date(date);
    return new Date();
  }, [date]);

  const { start, span } = useMemo(
    () => dayBounds(refDate, startHour, endHour),
    [refDate, startHour, endHour],
  );

  const nowPct = useMemo(() => {
    if (!live) return null;
    const now = Date.now();
    const pct = ((now - start.getTime()) / span) * 100;
    return Math.min(100, Math.max(0, pct));
  }, [live, start, span]);

  const rendered = useMemo(
    () =>
      segments.map((seg, i) => {
        const segStart = new Date(seg.startTs).getTime();
        const segEnd = new Date(seg.endTs).getTime();
        const left = ((segStart - start.getTime()) / span) * 100;
        const width = ((segEnd - segStart) / span) * 100;
        return {
          key: `${seg.startTs}-${i}`,
          left: Math.max(0, left),
          width: Math.max(0.5, width),
          state: seg.state,
          label: `${seg.state}${seg.reason ? `: ${seg.reason}` : ''} (${seg.durationSec}s)`,
        };
      }),
    [segments, start, span],
  );

  return (
    <div>
      <div className={styles.track} role="img" aria-label="Agent day timeline">
        {rendered.map(seg => (
          <div
            key={seg.key}
            className={`${styles.segment} ${segmentClass(seg.state)}`}
            style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
            title={seg.label}
            aria-label={seg.label}
          />
        ))}
        {nowPct != null && (
          <div className={styles.nowMarker} style={{ left: `${nowPct}%` }} aria-hidden />
        )}
      </div>
      <div className={styles.labels}>
        <span>{formatHourLabel(startHour)}</span>
        <span>{formatHourLabel(endHour === 24 ? 0 : endHour)}</span>
      </div>
    </div>
  );
});
