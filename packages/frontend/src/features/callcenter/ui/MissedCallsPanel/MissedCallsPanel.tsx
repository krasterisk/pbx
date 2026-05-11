import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { PhoneMissed, X, Check } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import {
  useGetMissedCallsQuery,
  useMarkMissedCalledBackMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { rtkApi } from '@/shared/api/rtkApi';
import styles from './MissedCallsPanel.module.scss';

interface Props {
  /** Called when the operator clicks "Call back" on a row. */
  onCallback?: (number: string) => void;
}

const fmtAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

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
        title={t('callcenter.missed.title', 'Missed calls')}
      >
        <PhoneMissed className="w-4 h-4" />
        <span className={styles.count}>{count}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <Text className={styles.title}>
              <PhoneMissed className="w-4 h-4 inline mr-1.5" />
              {t('callcenter.missed.title', 'Missed calls')}
            </Text>
            <button className={styles.close} onClick={() => setOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {missed.length === 0 ? (
            <Text variant="muted" className="text-xs text-center py-4">
              {t('callcenter.missed.empty', 'No missed calls — nice work!')}
            </Text>
          ) : (
            <div className={styles.list}>
              {missed.map(m => (
                <div key={m.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <Text className={styles.rowNum}>
                      {m.caller_id_num || t('callcenter.missed.unknown', 'Unknown')}
                    </Text>
                    {m.caller_id_name && (
                      <Text variant="muted" className="text-xs">{m.caller_id_name}</Text>
                    )}
                    <Text variant="muted" className="text-xs">
                      {m.queue_name} · {fmtAgo(m.created_at)}
                      {m.hold_time ? ` · ${m.hold_time}s wait` : ''}
                    </Text>
                  </div>

                  <div className={styles.rowActions}>
                    {onCallback && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCallback(m.caller_id_num)}
                      >
                        {t('callcenter.missed.callBack', 'Call back')}
                      </Button>
                    )}
                    <button
                      className={styles.rowDone}
                      onClick={async () => {
                        await markCalled({ id: m.id });
                        refetch();
                      }}
                      title={t('callcenter.missed.markDone', 'Mark handled')}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
