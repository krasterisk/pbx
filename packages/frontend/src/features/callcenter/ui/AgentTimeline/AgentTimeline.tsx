import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/ui';
import type { AgentStatus, AgentTimelineSegment } from '../../model/types/callCenterSchema';
import { agentStatusLabel, formatPauseReason } from '../../lib/displayLabels';
import { formatCcDuration } from '../../lib/ccFormat';
import styles from './AgentTimeline.module.scss';

export interface AgentTimelineProps {
  segments: AgentTimelineSegment[];
  date?: string;
  periodStart?: string;
  periodEnd?: string;
  timezone?: string;
  live?: boolean;
  startHour?: number;
  endHour?: number;
}
function segmentClass(state: string): string {
  switch (state) {
    case 'READY': return styles.segmentReady;
    case 'IN_CALL': case 'RINGING': case 'DIALING': case 'CONSULT': return styles.segmentInCall;
    case 'PAUSED': case 'OUTBOUND_WORK': return styles.segmentPaused;
    case 'WRAPUP': case 'ACW': return styles.segmentWrapup;
    case 'HOLD': return styles.segmentHold;
    default: return styles.segmentOffline;
  }
}

/** Absolute bounds supplied by reports preserve the tenant calendar, including DST days. */
export const AgentTimeline = memo(function AgentTimeline({
  segments, date, periodStart, periodEnd, timezone, live = false, startHour = 0, endHour = 24,
}: AgentTimelineProps) {
  const { t, i18n } = useTranslation();
  const [zoom, setZoom] = useState(false);
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const bounds = useMemo(() => {
    const day = date ? new Date(`${date}T00:00:00`) : new Date();
    day.setHours(startHour, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(endHour, 0, 0, 0);
    const start = periodStart ? Date.parse(periodStart) : day.getTime();
    const end = periodEnd ? Date.parse(periodEnd) + 1 : dayEnd.getTime();
    return { start, end };
  }, [date, startHour, endHour, periodStart, periodEnd]);
  const visible = segments.flatMap((seg, index) => {
    const start = Math.max(bounds.start, Date.parse(seg.startTs));
    const end = Math.min(bounds.end, Date.now(), Date.parse(seg.endTs));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const label = agentStatusLabel(seg.state as AgentStatus, t);
    const reason = formatPauseReason(seg.reason, t);
    return [{ key: `${seg.startTs}-${index}`, state: seg.state, start, end,
      label: `${label}${reason ? `: ${reason}` : ''}`, duration: formatCcDuration((end - start) / 1000) }];
  });
  const start = zoom && visible.length ? Math.min(...visible.map((s) => s.start)) : bounds.start;
  const end = zoom && visible.length ? Math.max(...visible.map((s) => s.end)) : bounds.end;
  const span = Math.max(1, end - start);
  const nowPct = Math.max(0, Math.min(100, ((Date.now() - start) / span) * 100));
  return (
    <div>
      <Button size="sm" variant="ghost" onClick={() => setZoom(!zoom)} aria-pressed={zoom}>
        {t(zoom ? 'callcenter.reports.timelineDay' : 'callcenter.reports.timelineZoom', zoom ? 'Full day' : 'Fit recorded activity')}
      </Button>
      <div className={styles.track} role="img" aria-label={t('callcenter.reports.timelineLabel', 'Agent day timeline')}>
        {visible.map((seg) => <div key={seg.key} className={`${styles.segment} ${segmentClass(seg.state)}`}
          style={{ left: `${((seg.start - start) / span) * 100}%`, width: `${((seg.end - seg.start) / span) * 100}%` }}
          title={`${seg.label} (${seg.duration})`} aria-label={`${seg.label} (${seg.duration})`} tabIndex={0} />)}
        {live && <div className={styles.nowMarker} style={{ left: `${nowPct}%` }} aria-hidden />}
      </div>
      <div className={styles.labels}>
        <span>{zoom ? formatTime(new Date(start).toISOString()) : `${String(startHour).padStart(2, '0')}:00`}</span>
        <span>{zoom ? formatTime(new Date(end).toISOString()) : `${String(endHour).padStart(2, '0')}:00`}</span>
      </div>
      {timezone && <Text variant="muted">{timezone}</Text>}
      <Table showSearch={false} showExport={false}>
        <TableHeader><TableRow>
          <TableHead>{t('callcenter.reports.timelineStart', 'Start')}</TableHead>
          <TableHead>{t('callcenter.reports.timelineEnd', 'End')}</TableHead>
          <TableHead>{t('callcenter.reports.timelineState', 'State and duration')}</TableHead>
        </TableRow></TableHeader>
        <TableBody>{visible.map((seg) => <TableRow key={seg.key}>
          <TableCell>{formatTime(new Date(seg.start).toISOString())}</TableCell>
          <TableCell>{formatTime(new Date(seg.end).toISOString())}</TableCell>
          <TableCell>{seg.label} · {seg.duration}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>
  );
});
