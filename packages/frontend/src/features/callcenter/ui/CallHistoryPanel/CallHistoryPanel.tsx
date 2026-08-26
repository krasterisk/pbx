import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  PhoneIncoming, PhoneOutgoing, Phone, PhoneMissed, PhoneCall, IdCard, Search,
} from 'lucide-react';
import { Button, Text, SegmentedControl, Input, Select, Tooltip } from '@/shared/ui';
import {
  useGetOperatorCallHistoryQuery,
  useGetSupervisorCallHistoryQuery,
  useClickToCallMutation,
  useLazyGetCardByCallQuery,
  useGetCardTemplatesQuery,
  type IOperatorHistoryRow,
} from '@/shared/api/endpoints/callCenterApi';
import { selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { requestOutboundDial } from '@/features/callcenter/model/slice/callCenterSlice';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import {
  loadKpiDisplay,
  PANEL_PREFS_EVENT,
  type KpiDisplayMode,
} from '@/features/callcenter/lib/agentPanelPrefs';
import { CallCardPopup } from '@/features/callcenter/ui/CallCardPopup/CallCardPopup';
import type { CallCardContext } from '@/features/callcenter/lib/useCallCardPopup';
import type { ICardTemplate } from '@/features/callcenter/model/types/callCard';
import styles from './CallHistoryPanel.module.scss';

type HistoryPeriod = 'shift' | 'day';

/** ARM History segment tabs (D-07) - no Missed segment. */
export type HistorySegment = 'queue' | 'outbound' | 'personal';

/** Status filter for History list (queue: answered / missed / transferred / …). */
export type HistoryStatusFilter =
  | 'all'
  | 'answered'
  | 'missed'
  | 'transferred'
  | 'other';

interface DirectionVisual {
  Icon: typeof PhoneIncoming;
  colorClass: string;
}

/** Map CC KPI panel preference → history API period (`both` → day window). */
export function historyPeriodFromKpi(kpi: KpiDisplayMode): HistoryPeriod {
  return kpi === 'shift' ? 'shift' : 'day';
}

function directionVisual(row: Pick<IOperatorHistoryRow, 'direction' | 'disposition'>): DirectionVisual {
  if (row.disposition === 'abandoned' || row.disposition === 'timeout') {
    return { Icon: PhoneMissed, colorClass: styles.iconMissed };
  }
  if (row.direction === 'inbound') return { Icon: PhoneIncoming, colorClass: styles.iconInbound };
  if (row.direction === 'outbound') return { Icon: PhoneOutgoing, colorClass: styles.iconOutbound };
  return { Icon: Phone, colorClass: styles.iconOther };
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function isDirectQueue(queueName: string | null): boolean {
  return !queueName || queueName.startsWith('direct:');
}

function isMissedDisposition(disposition: IOperatorHistoryRow['disposition']): boolean {
  return disposition === 'abandoned' || disposition === 'timeout';
}

/** Queue segment = inbound rows that arrived via a real queue (not direct:/empty). */
export function isQueueHistoryRow(row: Pick<IOperatorHistoryRow, 'direction' | 'queueName'>): boolean {
  return row.direction === 'inbound' && !isDirectQueue(row.queueName);
}

/** Client-side segment filter over getOperatorCallHistory rows (D-07). */
export function matchesHistorySegment(
  row: Pick<IOperatorHistoryRow, 'direction' | 'queueName'>,
  segment: HistorySegment,
): boolean {
  if (segment === 'queue') return isQueueHistoryRow(row);
  if (segment === 'outbound') return row.direction === 'outbound';
  // Personal = personal / direct inbound / internal (not queue, not outbound)
  return (
    row.direction === 'personal'
    || row.direction === 'internal'
    || (row.direction === 'inbound' && isDirectQueue(row.queueName))
  );
}

function isAnsweredDisposition(disposition: IOperatorHistoryRow['disposition']): boolean {
  return disposition === 'answered' || disposition === 'transferred';
}

/** Status tokens for Outbound/Personal search (D-10) - no new locale keys. */
export function historyStatusSearchHaystack(
  disposition: IOperatorHistoryRow['disposition'],
): string {
  if (isAnsweredDisposition(disposition)) {
    return `answered отвечен ${disposition}`;
  }
  return `not answered не отвечен unanswered ${disposition}`;
}

export function matchesHistoryStatus(
  row: Pick<IOperatorHistoryRow, 'disposition'>,
  status: HistoryStatusFilter,
): boolean {
  if (status === 'all') return true;
  if (status === 'answered') return row.disposition === 'answered';
  if (status === 'missed') return isMissedDisposition(row.disposition);
  if (status === 'transferred') return row.disposition === 'transferred';
  return row.disposition === 'other';
}

/**
 * Per-segment quick search (D-10):
 * Queue → number / name / queue; Outbound/Personal → number / name / status.
 */
export function matchesHistorySearch(
  row: Pick<
    IOperatorHistoryRow,
    'callerIdNum' | 'callerIdName' | 'queueName' | 'disposition' | 'direction'
  >,
  segment: HistorySegment,
  query: string,
  queueLabel?: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const number = (row.callerIdNum || '').toLowerCase();
  const name = (row.callerIdName || '').toLowerCase();
  if (number.includes(q) || name.includes(q)) return true;

  if (segment === 'queue') {
    const queue = (row.queueName || '').toLowerCase();
    const label = (queueLabel || '').toLowerCase();
    return queue.includes(q) || label.includes(q);
  }

  return historyStatusSearchHaystack(row.disposition).toLowerCase().includes(q);
}

function handledByLabel(row: IOperatorHistoryRow): string | null {
  if (!row.handledByName && !row.handledByExten) return null;
  if (row.handledByName && row.handledByExten) {
    return `${row.handledByName} (${row.handledByExten})`;
  }
  return row.handledByName || row.handledByExten || null;
}

interface CallHistoryPanelProps {
  summaryOnly?: boolean;
  /** From CC settings «Период KPI панели»; falls back to localStorage. */
  kpiDisplay?: KpiDisplayMode;
  /** Operator self-history (default) or supervisor watched-agents history. */
  source?: 'operator' | 'supervisor';
}

/**
 * Operator call-history panel (D-34/D-35) - reverse-chronological list.
 * Period follows KPI panel preference (no Shift/Day tabs). Segments:
 * Queue / Outbound / Personal + status filter.
 */
export function CallHistoryPanel({
  summaryOnly = false,
  kpiDisplay: kpiDisplayProp,
  source = 'operator',
}: CallHistoryPanelProps = {}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [kpiDisplay, setKpiDisplay] = useState<KpiDisplayMode>(
    () => kpiDisplayProp ?? loadKpiDisplay(),
  );
  const [segment, setSegment] = useState<HistorySegment>('queue');
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('all');
  const [search, setSearch] = useState('');
  const ccQueues = useSelector(selectCcQueues);

  useEffect(() => {
    if (kpiDisplayProp) {
      setKpiDisplay(kpiDisplayProp);
      return;
    }
    const sync = () => setKpiDisplay(loadKpiDisplay());
    sync();
    window.addEventListener(PANEL_PREFS_EVENT, sync);
    return () => window.removeEventListener(PANEL_PREFS_EVENT, sync);
  }, [kpiDisplayProp]);

  const period = historyPeriodFromKpi(kpiDisplay);
  const operatorQuery = useGetOperatorCallHistoryQuery(
    { period },
    { skip: source !== 'operator' },
  );
  const supervisorQuery = useGetSupervisorCallHistoryQuery(
    { period: 'day' },
    { skip: source !== 'supervisor' },
  );
  const rows = (source === 'supervisor' ? supervisorQuery.data : operatorQuery.data) ?? [];
  const isFetching = source === 'supervisor' ? supervisorQuery.isFetching : operatorQuery.isFetching;
  const { data: templates = [] } = useGetCardTemplatesQuery();
  const [clickToCall, { isLoading: isCalling }] = useClickToCallMutation();
  const [triggerGetCardByCall] = useLazyGetCardByCallQuery();

  const [pendingId, setPendingId] = useState<number | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardTemplate, setCardTemplate] = useState<ICardTemplate | null>(null);
  const [cardInitialValues, setCardInitialValues] = useState<Record<string, unknown>>({});
  const [cardContext, setCardContext] = useState<CallCardContext | null>(null);

  const queueLabelSources = useMemo(
    () => ccQueues.map((q) => ({ name: q.name, displayName: q.displayName })),
    [ccQueues],
  );

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!matchesHistorySegment(row, segment)) return false;
      if (!matchesHistoryStatus(row, statusFilter)) return false;
      const queueLabel = row.queueName
        ? queueDisplayName(row.queueName, queueLabelSources)
        : undefined;
      return matchesHistorySearch(row, segment, search, queueLabel);
    });
  }, [rows, segment, statusFilter, search, queueLabelSources]);

  const missedCount = useMemo(
    () => rows.filter((r) => isMissedDisposition(r.disposition)).length,
    [rows],
  );
  const inboundCount = useMemo(() => rows.filter((r) => r.direction === 'inbound').length, [rows]);
  const outboundCount = useMemo(() => rows.filter((r) => r.direction === 'outbound').length, [rows]);

  const periodLabel = kpiDisplay === 'both'
    ? t('callcenter.kpi.hint', 'Left: this shift · Right: since midnight')
    : kpiDisplay === 'day'
      ? t('callcenter.kpi.day', 'Since midnight')
      : t('callcenter.kpi.shift', 'This shift');

  const periodHint = (
    <Text variant="muted" className={styles.periodHint} data-testid="history-period-hint">
      {periodLabel}
    </Text>
  );

  const segmentControl = (
    <SegmentedControl
      ariaLabel={t('callcenter.history.segmentQueue', 'Queue')}
      value={segment}
      onChange={(v) => {
        setSegment(v);
        setStatusFilter('all');
      }}
      options={[
        { value: 'queue', label: t('callcenter.history.segmentQueue', 'Queue') },
        { value: 'outbound', label: t('callcenter.history.segmentOutbound', 'Outbound') },
        { value: 'personal', label: t('callcenter.history.segmentPersonal', 'Personal') },
      ]}
    />
  );

  const statusOptions = segment === 'queue'
    ? ([
        { value: 'all', label: t('callcenter.history.statusAll', 'All statuses') },
        { value: 'answered', label: t('callcenter.history.disposition.answered', 'Answered') },
        { value: 'missed', label: t('callcenter.history.statusMissed', 'Missed') },
        { value: 'transferred', label: t('callcenter.history.disposition.transferred', 'Transferred') },
        { value: 'other', label: t('callcenter.history.disposition.other', 'Other') },
      ] as const)
    : ([
        { value: 'all', label: t('callcenter.history.statusAll', 'All statuses') },
        { value: 'answered', label: t('callcenter.history.disposition.answered', 'Answered') },
        { value: 'missed', label: t('callcenter.history.statusMissed', 'Missed') },
        { value: 'other', label: t('callcenter.history.disposition.other', 'Other') },
      ] as const);

  const searchPlaceholder = segment === 'queue'
    ? t('callcenter.history.searchPlaceholderQueue', 'Search by number, name or queue...')
    : segment === 'outbound'
      ? t('callcenter.history.searchPlaceholderOutbound', 'Search by number, name or status...')
      : t('callcenter.history.searchPlaceholderPersonal', 'Search by number, name or status...');

  if (summaryOnly) {
    return (
      <div className={styles.summaryBarInline} data-testid="history-panel-summary">
        <span className={styles.summaryChip}>
          <Text className={styles.summaryValue}>{rows.length}</Text>
          <Text variant="muted" className={styles.summaryLabel}>{t('callcenter.history.summaryTotal', 'calls')}</Text>
        </span>
        <span className={styles.summaryChip}>
          <Text className={styles.summaryValue}>{inboundCount}</Text>
          <Text variant="muted" className={styles.summaryLabel}>{t('callcenter.history.summaryIn', 'in')}</Text>
        </span>
        <span className={styles.summaryChip}>
          <Text className={styles.summaryValue}>{outboundCount}</Text>
          <Text variant="muted" className={styles.summaryLabel}>{t('callcenter.history.summaryOut', 'out')}</Text>
        </span>
        <span className={`${styles.summaryChip} ${missedCount > 0 ? styles.summaryChipWarn : ''}`}>
          <Text className={styles.summaryValue}>{missedCount}</Text>
          <Text variant="muted" className={styles.summaryLabel}>{t('callcenter.history.missedTag', 'Missed')}</Text>
        </span>
      </div>
    );
  }

  const handleCallback = async (row: IOperatorHistoryRow) => {
    if (!row.callerIdNum) return;
    setPendingId(row.uid);
    try {
      const res = await clickToCall({ target: row.callerIdNum }).unwrap();
      if (res.mode === 'webrtc' && res.target) {
        dispatch(requestOutboundDial(res.target));
      }
    } catch { /* dial-initiation error - nothing more to do client-side */ }
    finally { setPendingId(null); }
  };

  const handleOpenCard = async (row: IOperatorHistoryRow) => {
    try {
      const card = await triggerGetCardByCall(row.callUniqueid).unwrap();
      const tpl = templates.find((tp) => tp.uid === card.template_id) ?? null;
      if (!tpl) {
        toast.info(t('callcenter.history.noCard', 'No call card saved for this call'));
        return;
      }
      setCardTemplate(tpl);
      setCardInitialValues(card.field_values || {});
      setCardContext({
        uniqueid: row.callUniqueid,
        callerId: row.callerIdNum,
        queue: card.queue_name || row.queueName || '',
      });
      setCardOpen(true);
    } catch {
      toast.info(t('callcenter.history.noCard', 'No call card saved for this call'));
    }
  };

  const kindTag = (row: IOperatorHistoryRow): string | null => {
    const isDirect = isDirectQueue(row.queueName);
    if (!isDirect && row.direction === 'inbound') {
      return queueDisplayName(row.queueName as string, queueLabelSources);
    }
    if (row.direction === 'personal') return t('callcenter.history.kind.personal', 'Personal');
    if (row.direction === 'outbound') return t('callcenter.history.kind.outbound', 'Outbound');
    if (row.direction === 'internal') return t('callcenter.history.kind.internal', 'Internal');
    return null;
  };

  const dispositionTag = (row: IOperatorHistoryRow): string | null => {
    if (row.disposition === 'answered') {
      return t('callcenter.history.disposition.answered', 'Answered');
    }
    if (row.disposition === 'transferred') {
      return t('callcenter.history.disposition.transferred', 'Transferred');
    }
    if (isMissedDisposition(row.disposition)) {
      return t('callcenter.history.missedTag', 'Missed');
    }
    if (row.disposition === 'other') {
      return t('callcenter.history.disposition.other', 'Other');
    }
    return null;
  };

  return (
    <div className={styles.wrap} data-testid="history-panel">
      <div className={styles.header}>
        <Text className={styles.title}>{t('callcenter.history.title', 'Call history')}</Text>
        {periodHint}
      </div>

      <div className={styles.filterRow} data-testid="history-segment-control">
        {segmentControl}
      </div>

      <div className={styles.filtersSecondary}>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as HistoryStatusFilter)}
          aria-label={t('callcenter.history.statusFilter', 'Status filter')}
          data-testid="history-status-filter"
          className={styles.statusSelect}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
        <div className={styles.searchRow}>
          <Search className="w-4 h-4" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            data-testid="history-search"
          />
        </div>
      </div>

      {filteredRows.length === 0 && !isFetching ? (
        <Text variant="muted" className={styles.empty}>
          {t('callcenter.history.empty', 'No calls in this period')}
        </Text>
      ) : (
        <div className={styles.list}>
          {filteredRows.map((row) => {
            const { Icon, colorClass } = directionVisual(row);
            const tag = kindTag(row);
            const status = dispositionTag(row);
            const timestamp = row.enterTime || row.answerTime || row.endTime;
            const isMissed = isMissedDisposition(row.disposition);
            const handler = handledByLabel(row);
            return (
              <div key={row.uid} className={styles.row} data-testid={`history-row-${row.uid}`}>
                <Icon className={`w-4 h-4 ${colorClass}`} aria-hidden />
                <div className={styles.rowMain}>
                  <div className={styles.rowTop}>
                    <Text className={styles.rowNum}>
                      {row.callerIdName || row.callerIdNum || t('callcenter.missed.unknown', 'Unknown')}
                    </Text>
                    {status && (
                      <span className={isMissed ? styles.missedTag : styles.tag}>{status}</span>
                    )}
                  </div>
                  <div className={styles.rowTags}>
                    {tag && <span className={styles.tag}>{tag}</span>}
                    {row.disposition === 'transferred' && row.transferDestination && (
                      <Text variant="muted" className="text-xs" data-testid={`history-xfer-${row.uid}`}>
                        {t('callcenter.history.transferredTo', '→ {{target}}', {
                          target: row.transferDestination,
                        })}
                      </Text>
                    )}
                    {isMissed && handler && (
                      <Text variant="muted" className="text-xs" data-testid={`history-handled-${row.uid}`}>
                        {t('callcenter.history.handledBy', 'Handled by {{name}}', { name: handler })}
                      </Text>
                    )}
                    {timestamp && (
                      <Text variant="muted" className="text-xs">
                        {new Date(timestamp).toLocaleString()}
                      </Text>
                    )}
                    <Text variant="muted" className="text-xs">{formatDuration(row.talkTime)}</Text>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <Tooltip content={t('callcenter.history.callBack', 'Call back')}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={styles.actionBtn}
                      disabled={!row.callerIdNum || (isCalling && pendingId === row.uid)}
                      aria-label={`${t('callcenter.history.callBack', 'Call back')} ${row.callerIdNum}`}
                      onClick={() => void handleCallback(row)}
                    >
                      <PhoneCall className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content={t('callcenter.history.openCard', 'Open card')}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={styles.actionBtn}
                      aria-label={`${t('callcenter.history.openCard', 'Open card')} ${row.callerIdNum}`}
                      onClick={() => void handleOpenCard(row)}
                    >
                      <IdCard className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CallCardPopup
        open={cardOpen}
        template={cardTemplate}
        initialValues={cardInitialValues}
        callContext={cardContext}
        isVip={false}
        onClose={() => setCardOpen(false)}
      />
    </div>
  );
}
