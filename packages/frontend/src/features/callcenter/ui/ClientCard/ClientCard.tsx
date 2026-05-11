import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BookUser, Phone, MapPin, FileText, Clock, Tag } from 'lucide-react';
import { Text } from '@/shared/ui';
import { useLazyClientLookupQuery } from '@/shared/api/endpoints/callCenterApi';
import styles from './ClientCard.module.scss';

interface Props {
  /** Caller's number (raw — backend normalizes by digits suffix). */
  callerIdNum?: string | null;
  /** Optional fallback display name from CallerID. */
  callerIdName?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'var(--color-info, #3b82f6)',
  in_progress: 'var(--color-warning, #f59e0b)',
  completed: 'var(--color-success, #10b981)',
  postponed: '#888',
  impossible: 'var(--color-destructive, #ef4444)',
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

/**
 * Read-only sidebar card with whatever we know about the current caller:
 *   - matching phonebook entries (with custom vars, e.g. account number)
 *   - last 10 service requests linked by phone number
 *
 * Triggered automatically whenever `callerIdNum` changes.
 */
export function ClientCard({ callerIdNum, callerIdName }: Props) {
  const { t } = useTranslation();
  const [trigger, { data, isFetching }] = useLazyClientLookupQuery();

  useEffect(() => {
    if (!callerIdNum) return;
    const t = setTimeout(() => trigger(callerIdNum), 200);
    return () => clearTimeout(t);
  }, [callerIdNum, trigger]);

  const primaryName = useMemo(() => {
    if (callerIdName) return callerIdName;
    const req = data?.requests?.[0];
    if (req?.counterparty_name) return req.counterparty_name;
    const c = data?.contacts?.[0];
    if (c?.vars?.name) return c.vars.name;
    return null;
  }, [callerIdName, data]);

  if (!callerIdNum) {
    return (
      <div className={styles.empty}>
        <BookUser className={styles.emptyIcon} />
        <Text variant="muted" className="text-xs text-center">
          {t('callcenter.clientCard.idle', 'No active call')}
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <BookUser className={styles.headerIcon} />
        <span>{t('callcenter.clientCard.title', 'Client Card')}</span>
      </div>

      <div className={styles.identity}>
        <Text className={styles.number}>
          <Phone className={styles.numberIcon} />
          {callerIdNum}
        </Text>
        {primaryName && <Text className={styles.name}>{primaryName}</Text>}
        {isFetching && (
          <Text variant="muted" className="text-xs italic">
            {t('callcenter.clientCard.searching', 'Searching…')}
          </Text>
        )}
      </div>

      {/* Phonebook matches */}
      {data && data.contacts.length > 0 && (
        <div className={styles.section}>
          <Text className={styles.sectionTitle}>
            <Tag className="w-3 h-3 inline mr-1" />
            {t('callcenter.clientCard.phonebooks', 'In phonebooks')}
          </Text>
          {data.contacts.map((c, i) => (
            <div key={i} className={styles.contactRow}>
              <span className={styles.contactPb}>{c.phonebook_name}</span>
              {c.comment && <span className={styles.contactNote}>{c.comment}</span>}
              {c.vars &&
                Object.entries(c.vars)
                  .slice(0, 4)
                  .map(([k, v]) => (
                    <span key={k} className={styles.contactVar}>
                      <b>{k}:</b> {String(v).slice(0, 24)}
                    </span>
                  ))}
            </div>
          ))}
        </div>
      )}

      {/* Recent service requests */}
      {data && data.requests.length > 0 && (
        <div className={styles.section}>
          <Text className={styles.sectionTitle}>
            <FileText className="w-3 h-3 inline mr-1" />
            {t('callcenter.clientCard.requests', 'Recent requests')}{' '}
            <span className="opacity-60">({data.requests.length})</span>
          </Text>
          {data.requests.slice(0, 5).map(r => (
            <div key={r.uid} className={styles.requestRow}>
              <span
                className={styles.requestDot}
                style={{ background: STATUS_COLORS[r.request_status] || '#888' }}
              />
              <div className={styles.requestBody}>
                <Text className={styles.requestTitle}>
                  {r.request_number || `#${r.uid}`}{' '}
                  {r.topic && <span className={styles.requestTopic}>· {r.topic}</span>}
                </Text>
                {r.address && (
                  <Text className={styles.requestMeta}>
                    <MapPin className="w-3 h-3 inline mr-0.5" />
                    {r.address}
                  </Text>
                )}
                <Text className={styles.requestMeta}>
                  <Clock className="w-3 h-3 inline mr-0.5" />
                  {fmtDate(r.created_at)} · {r.request_status}
                </Text>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && !data.matched && !isFetching && (
        <Text variant="muted" className="text-xs italic mt-2">
          {t('callcenter.clientCard.unknown', 'Caller not found in phonebooks')}
        </Text>
      )}
    </div>
  );
}
