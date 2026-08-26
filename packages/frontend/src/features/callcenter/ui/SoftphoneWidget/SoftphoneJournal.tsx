import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  PhoneIncoming, PhoneOutgoing, Phone, PhoneMissed, PhoneCall, IdCard,
} from 'lucide-react';
import { Button, Text, Tooltip } from '@/shared/ui';
import {
  useGetOperatorCallHistoryQuery,
  useGetTenantSettingsQuery,
  useClickToCallMutation,
  useLazyGetCardByCallQuery,
  useGetCardTemplatesQuery,
  useGetEffectivePermissionsQuery,
  type IOperatorHistoryRow,
} from '@/shared/api/endpoints/callCenterApi';
import { selectCcQueues, selectMyAgentInterface } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { requestOutboundDial, updateAgent } from '@/features/callcenter/model/slice/callCenterSlice';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import { CallCardPopup } from '@/features/callcenter/ui/CallCardPopup/CallCardPopup';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import type { CallCardContext } from '@/features/callcenter/lib/useCallCardPopup';
import type { ICardTemplate } from '@/features/callcenter/model/types/callCard';
import styles from './SoftphoneJournal.module.scss';

const DEFAULT_JOURNAL_DEPTH = 50;
/** Matches backend getOperatorCallHistory hard cap. */
const HISTORY_FETCH_CAP = 200;

interface DirectionVisual {
  Icon: typeof PhoneIncoming;
  colorClass: string;
}

function directionVisual(row: Pick<IOperatorHistoryRow, 'direction' | 'disposition'>): DirectionVisual {
  if (row.disposition === 'abandoned' || row.disposition === 'timeout') {
    return { Icon: PhoneMissed, colorClass: styles.iconMissed };
  }
  if (row.direction === 'inbound' || row.direction === 'personal') {
    return { Icon: PhoneIncoming, colorClass: styles.iconInbound };
  }
  if (row.direction === 'outbound' || row.direction === 'internal') {
    return { Icon: PhoneOutgoing, colorClass: styles.iconOutbound };
  }
  return { Icon: Phone, colorClass: styles.iconOther };
}

function directionAttr(row: Pick<IOperatorHistoryRow, 'direction' | 'disposition'>): string {
  if (row.disposition === 'abandoned' || row.disposition === 'timeout') return 'missed';
  if (row.direction === 'inbound' || row.direction === 'personal') return 'inbound';
  if (row.direction === 'outbound' || row.direction === 'internal') return 'outbound';
  return 'other';
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function peerLabel(row: Pick<IOperatorHistoryRow, 'callerIdNum' | 'callerIdName'>): string {
  const num = (row.callerIdNum || '').trim();
  const name = (row.callerIdName || '').trim();
  if (name && name !== 'unknown' && name !== num) {
    return num ? `${name} (${num})` : name;
  }
  return num || name || '';
}

function dispositionLabel(
  disposition: string | null | undefined,
  t: (key: string, fallback?: string) => string,
): { text: string; tone: 'success' | 'danger' | 'muted' } | null {
  switch (disposition) {
    case 'answered':
      return {
        text: t('callcenter.history.disposition.answered', 'Answered'),
        tone: 'success',
      };
    case 'abandoned':
    case 'timeout':
      return {
        text: t('callcenter.history.missedTag', 'Missed'),
        tone: 'danger',
      };
    case 'other':
      return {
        text: t('callcenter.history.disposition.failed', 'Failed'),
        tone: 'muted',
      };
    default:
      return disposition
        ? { text: disposition, tone: 'muted' }
        : null;
  }
}

/**
 * Softphone Journal tab (D-01..D-05) - blended personal call feed, N-capped,
 * callback + open-card only. Live prepend comes from 10-04 historyRow SSE
 * cache patch (no local SSE listener). Mounted by SoftphoneWidget in 10-08.
 */
export function SoftphoneJournal({ softphoneMode = 'webrtc' }: { softphoneMode?: 'webrtc' | 'sip' }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const ccQueues = useSelector(selectCcQueues);
  const myAgentInterface = useAppSelector(selectMyAgentInterface);
  const { data: permissions } = useGetEffectivePermissionsQuery();
  const sipClickBlocked = softphoneMode === 'sip' && permissions?.click_to_call === false;

  const {
    data: history = [],
    isFetching,
    isError,
    refetch,
  } = useGetOperatorCallHistoryQuery({ period: 'shift' });
  const { data: settings } = useGetTenantSettingsQuery();
  const { data: templates = [] } = useGetCardTemplatesQuery();
  const [clickToCall, { isLoading: isCalling }] = useClickToCallMutation();
  const [triggerGetCardByCall] = useLazyGetCardByCallQuery();

  const [pendingId, setPendingId] = useState<number | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardTemplate, setCardTemplate] = useState<ICardTemplate | null>(null);
  const [cardInitialValues, setCardInitialValues] = useState<Record<string, unknown>>({});
  const [cardContext, setCardContext] = useState<CallCardContext | null>(null);

  const journalDepth = settings?.journal_depth ?? DEFAULT_JOURNAL_DEPTH;
  const [visibleCount, setVisibleCount] = useState(journalDepth);

  useEffect(() => {
    setVisibleCount(journalDepth);
  }, [journalDepth]);

  const rows = useMemo(
    () => history.slice(0, visibleCount),
    [history, visibleCount],
  );
  const hasMore = history.length > visibleCount;

  const queueLabelSources = useMemo(
    () => ccQueues.map((q) => ({ name: q.name, displayName: q.displayName })),
    [ccQueues],
  );

  const handleCallback = async (row: IOperatorHistoryRow) => {
    if (!row.callerIdNum || sipClickBlocked) return;
    setPendingId(row.uid);
    try {
      const res = await clickToCall({ target: row.callerIdNum }).unwrap();
      if (res.mode === 'webrtc' && res.target) {
        dispatch(requestOutboundDial(res.target));
      }
      if (res.mode === 'pjsip' && res.target && myAgentInterface) {
        dispatch(updateAgent({
          interface: myAgentInterface,
          dialTarget: res.target,
          status: 'DIALING',
        }));
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
    const isDirect = !row.queueName || row.queueName.startsWith('direct:');
    if (!isDirect && row.direction === 'inbound') {
      return queueDisplayName(row.queueName as string, queueLabelSources);
    }
    if (row.direction === 'personal') return t('callcenter.history.kind.personal', 'Personal');
    if (row.direction === 'outbound') return t('callcenter.history.kind.outbound', 'Outbound');
    if (row.direction === 'internal') return t('callcenter.history.kind.internal', 'Internal');
    if (row.direction === 'inbound') return t('callcenter.history.direction.inbound', 'Inbound');
    return null;
  };

  if (isError) {
    return (
      <div className={styles.wrap} data-testid="softphone-journal">
        <div className={styles.errorCard}>
          <Text>{t('callcenter.journal.loadFailed', 'Could not load the journal')}</Text>
          <Tooltip content={t('callcenter.settings.retry', 'Retry')}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={styles.retryBtn}
              onClick={() => void refetch()}
              aria-label={t('callcenter.settings.retry', 'Retry')}
            >
              {t('callcenter.settings.retry', 'Retry')}
            </Button>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-testid="softphone-journal">
      {rows.length === 0 && !isFetching ? (
        <div className={styles.empty}>
          <Text className={styles.emptyTitle}>
            {t('callcenter.journal.emptyTitle', 'Journal is empty')}
          </Text>
          <Text variant="muted" className={styles.emptyBody}>
            {t('callcenter.journal.emptyBody', 'Calls will appear here after your first call')}
          </Text>
        </div>
      ) : (
        <div className={styles.list} data-testid="softphone-journal-list">
          {rows.map((row) => {
            const { Icon, colorClass } = directionVisual(row);
            const tag = kindTag(row);
            const peer = peerLabel(row) || t('callcenter.missed.unknown', 'Unknown');
            const status = dispositionLabel(row.disposition, t);
            const timestamp = row.enterTime || row.answerTime || row.endTime;
            return (
              <div
                key={row.uid}
                className={styles.row}
                data-testid="softphone-journal-row"
                data-direction={directionAttr(row)}
                data-disposition={row.disposition || ''}
              >
                <Icon className={`w-4 h-4 ${colorClass}`} aria-hidden />
                <div className={styles.rowMain}>
                  <div className={styles.rowTop}>
                    <Text className={styles.rowNum}>{peer}</Text>
                    {status && (
                      <span
                        className={
                          status.tone === 'danger'
                            ? styles.missedTag
                            : status.tone === 'success'
                              ? styles.statusOk
                              : styles.statusMuted
                        }
                        data-testid="softphone-journal-status"
                      >
                        {status.text}
                      </span>
                    )}
                  </div>
                  <div className={styles.rowTags}>
                    {tag && (
                      <span className={styles.tag} data-testid="softphone-journal-direction">
                        {tag}
                      </span>
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
                  <Tooltip
                    content={sipClickBlocked
                      ? t(
                        'callcenter.settings.permissions.clickToCallDenied',
                        'Click-to-call is not granted for SIP mode',
                      )
                      : t('callcenter.softphone.callBack', 'Call back')}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={styles.actionBtn}
                      disabled={!row.callerIdNum || sipClickBlocked || (isCalling && pendingId === row.uid)}
                      aria-label={`${t('callcenter.softphone.callBack', 'Call back')} ${row.callerIdNum}`}
                      onClick={() => void handleCallback(row)}
                    >
                      <PhoneCall className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content={t('callcenter.softphone.openCard', 'Open card')}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={styles.actionBtn}
                      aria-label={`${t('callcenter.softphone.openCard', 'Open card')} ${row.callerIdNum}`}
                      onClick={() => void handleOpenCard(row)}
                    >
                      <IdCard className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <Tooltip content={t('callcenter.journal.showMore', 'Show more')}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.showMoreBtn}
                data-testid="softphone-journal-show-more"
                onClick={() => setVisibleCount((n) => Math.min(n + journalDepth, HISTORY_FETCH_CAP))}
              >
                {t('callcenter.journal.showMore', 'Show more')}
              </Button>
            </Tooltip>
          )}
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
