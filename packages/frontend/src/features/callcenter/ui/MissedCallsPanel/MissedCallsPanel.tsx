import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { PhoneMissed, X, Check } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import {
  useGetMissedCallsQuery,
  useMarkMissedCalledBackMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import { rtkApi } from '@/shared/api/rtkApi';
import styles from './MissedCallsPanel.module.scss';

interface Props {
  /** Called when the operator clicks "Call back" on a row. */
  onCallback?: (number: string) => void;
}

/**
 * Missed-calls panel — badge + dropdown list. Auto-refreshes when SSE pushes
 * a `missedCallNew` event by invalidating the cache.
 */
export function MissedCallsPanel({ onCallback }: Props) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const { data: missed = [], refetch } = useGetMissedCallsQuery();
  const [markCalled] = useMarkMissedCalledBackMutation();
  const ccQueues = useSelector(selectCcQueues);
  const { data: queueList = [] } = useGetQueuesQuery();

  const queueLabelSources = [
    ...ccQueues.map((q) => ({ name: q.name, displayName: q.displayName })),
    ...queueList.map((q) => ({
      name: q.name,
      displayName: q.display_name || q.name,
      exten: q.exten,
    })),
  ];

  const fmtAgo = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60_000);
    if (m < 1) return t('callcenter.missed.justNow');
    if (m < 60) return t('callcenter.missed.agoMinutes', { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('callcenter.missed.agoHours', { count: h });
    return t('callcenter.missed.agoDays', { count: Math.floor(h / 24) });
  };

  // Refresh when SSE notifies us
  useEffect(() => {
    const handler = () => {
      dispatch(rtkApi.util.invalidateTags(['MissedCalls']));
    };
    window.addEventListener('cc:missed-call-new', handler);
    return () => window.removeEventListener('cc:missed-call-new', handler);
  }, [dispatch]);

  const count = missed.length;

  return (
    <div className={styles.wrap}>
      <button
        className={`${styles.badge} ${count > 0 ? styles.badgeAlert : ''}`}
        onClick={() => setOpen(o => !o)}
        title={t('callcenter.missed.title')}
      >
        <PhoneMissed className="w-4 h-4" />
        <span className={styles.count}>{count}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <Text className={styles.title}>
              <PhoneMissed className="w-4 h-4 inline mr-1.5" />
              {t('callcenter.missed.title')}
            </Text>
            <button
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {missed.length === 0 ? (
            <Text variant="muted" className="text-xs text-center py-4">
              {t('callcenter.missed.empty')}
            </Text>
          ) : (
            <div className={styles.list}>
              {missed.map(m => {
                const rowId = m.uid ?? m.id!;
                return (
                <div key={rowId} className={styles.row}>
                  <div className={styles.rowMain}>
                    <Text className={styles.rowNum}>
                      {m.caller_id_num || t('callcenter.missed.unknown')}
                    </Text>
                    {m.caller_id_name && (
                      <Text variant="muted" className="text-xs">{m.caller_id_name}</Text>
                    )}
                    <Text variant="muted" className="text-xs">
                      {queueDisplayName(m.queue_name, queueLabelSources)}
                      {' · '}
                      {fmtAgo(m.created_at)}
                      {m.hold_time
                        ? ` · ${t('callcenter.missed.holdWait', { seconds: m.hold_time })}`
                        : ''}
                    </Text>
                  </div>

                  <div className={styles.rowActions}>
                    {onCallback && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCallback(m.caller_id_num)}
                      >
                        {t('callcenter.missed.callBack')}
                      </Button>
                    )}
                    <button
                      className={styles.rowDone}
                      onClick={async () => {
                        await markCalled({ id: rowId });
                        refetch();
                      }}
                      title={t('callcenter.missed.markDone')}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
