import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  PhoneIncoming, PhoneOutgoing, Phone, PhoneMissed, PhoneCall, IdCard,
} from 'lucide-react';
import { Button, Text, SegmentedControl } from '@/shared/ui';
import {
  useGetOperatorCallHistoryQuery,
  useClickToCallMutation,
  useLazyGetCardByCallQuery,
  useGetCardTemplatesQuery,
  type IOperatorHistoryRow,
} from '@/shared/api/endpoints/callCenterApi';
import { selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import { CallCardPopup } from '@/features/callcenter/ui/CallCardPopup/CallCardPopup';
import type { CallCardContext } from '@/features/callcenter/lib/useCallCardPopup';
import type { ICardTemplate } from '@/features/callcenter/model/types/callCard';
import styles from './CallHistoryPanel.module.scss';

type Period = 'shift' | 'day';

interface DirectionVisual {
  Icon: typeof PhoneIncoming;
  colorClass: string;
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
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Operator call-history panel (D-34/D-35) — reverse-chronological list of
 * ALL directions (inbound/outbound/personal/internal, in-queue RNA excluded
 * per D-20) with a shift/day filter, click-to-callback, and open-call-card
 * (reuses CallCardPopup, no bespoke viewer per the UI-SPEC Surface 11 note).
 */
export function CallHistoryPanel() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('shift');
  const ccQueues = useSelector(selectCcQueues);

  const { data: rows = [], isFetching } = useGetOperatorCallHistoryQuery({ period });
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

  const handleCallback = async (row: IOperatorHistoryRow) => {
    if (!row.callerIdNum) return;
    setPendingId(row.uid);
    try {
      await clickToCall({ target: row.callerIdNum }).unwrap();
    } catch { /* dial-initiation error — nothing more to do client-side */ }
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
    const isDirect = !row.queueName || row.queueName.startsWith('direct:');
    if (!isDirect && row.direction === 'inbound') {
      return queueDisplayName(row.queueName as string, queueLabelSources);
    }
    if (row.direction === 'personal') return t('callcenter.history.kind.personal', 'Personal');
    if (row.direction === 'outbound') return t('callcenter.history.kind.outbound', 'Outbound');
    if (row.direction === 'internal') return t('callcenter.history.kind.internal', 'Internal');
    return null;
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <Text className={styles.title}>{t('callcenter.history.title', 'Call history')}</Text>
        <SegmentedControl
          ariaLabel={t('callcenter.history.title', 'Call history')}
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'shift', label: t('callcenter.history.shift', 'Shift') },
            { value: 'day', label: t('callcenter.history.day', 'Day') },
          ]}
        />
      </div>

      {rows.length === 0 && !isFetching ? (
        <Text variant="muted" className={styles.empty}>
          {t('callcenter.history.empty', 'No calls in this period')}
        </Text>
      ) : (
        <div className={styles.list}>
          {rows.map((row) => {
            const { Icon, colorClass } = directionVisual(row);
            const tag = kindTag(row);
            const timestamp = row.enterTime || row.answerTime || row.endTime;
            const isMissed = row.disposition === 'abandoned' || row.disposition === 'timeout';
            return (
              <div key={row.uid} className={styles.row}>
                <Icon className={`w-4 h-4 ${colorClass}`} aria-hidden />
                <div className={styles.rowMain}>
                  <div className={styles.rowTop}>
                    <Text className={styles.rowNum}>
                      {row.callerIdName || row.callerIdNum || t('callcenter.missed.unknown', 'Unknown')}
                    </Text>
                    {isMissed && (
                      <span className={styles.missedTag}>{t('callcenter.history.missedTag', 'Missed')}</span>
                    )}
                  </div>
                  <div className={styles.rowTags}>
                    {tag && <span className={styles.tag}>{tag}</span>}
                    {timestamp && (
                      <Text variant="muted" className="text-xs">
                        {new Date(timestamp).toLocaleString()}
                      </Text>
                    )}
                    <Text variant="muted" className="text-xs">{formatDuration(row.talkTime)}</Text>
                  </div>
                </div>
                <div className={styles.rowActions}>
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
