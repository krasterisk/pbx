import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ParkingCircle, X, PhoneCall } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import {
  useGetParkedCallsQuery,
  useRetrieveParkedCallMutation,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './ParkedCallsIndicator.module.scss';

/**
 * Tenant-wide parking lot indicator (D-28) — badge + dropdown, mirrors
 * MissedCallsPanel's shape 1:1 but with an info-tint (neutral, not a
 * warning) and a per-entry Retrieve action. Auto-refreshes via the
 * ParkedCalls RTK cache tag, invalidated on any operator's park/retrieve
 * through the parkedCallsUpdate SSE event (useCallCenterSSE.ts).
 */
export function ParkedCallsIndicator() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { data: parked = [] } = useGetParkedCallsQuery();
  const [retrieveParkedCall, { isLoading: isRetrieving }] = useRetrieveParkedCallMutation();

  const handleRetrieve = async (parkingSpace: string) => {
    try {
      await retrieveParkedCall({ parkingSpace }).unwrap();
    } catch { /* server is source of truth — parked list refetches regardless via ParkedCalls tag */ }
  };

  const count = parked.length;

  return (
    <div className={styles.wrap}>
      <button
        className={styles.badge}
        onClick={() => setOpen((o) => !o)}
        title={t('callcenter.parked.title')}
      >
        <ParkingCircle className="w-4 h-4" />
        <span className={styles.count}>{count}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <Text className={styles.title}>
              <ParkingCircle className="w-4 h-4 inline mr-1.5" />
              {t('callcenter.parked.title')}
            </Text>
            <button
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {parked.length === 0 ? (
            <Text variant="muted" className="text-xs text-center py-4">
              {t('callcenter.parked.empty')}
            </Text>
          ) : (
            <div className={styles.list}>
              {parked.map((p) => (
                <div key={p.parkingSpace} className={styles.row}>
                  <div className={styles.rowMain}>
                    <Text className={styles.rowNum}>
                      {p.callerIdNum || t('callcenter.missed.unknown')}
                    </Text>
                    {p.callerIdName && (
                      <Text variant="muted" className="text-xs">{p.callerIdName}</Text>
                    )}
                    <Text variant="muted" className="text-xs">
                      {t('callcenter.parked.spaceLabel', 'Space {{space}}', { space: p.parkingSpace })}
                    </Text>
                  </div>

                  <div className={styles.rowActions}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRetrieving}
                      onClick={() => handleRetrieve(p.parkingSpace)}
                    >
                      <PhoneCall className="w-3.5 h-3.5 mr-1" />
                      {isRetrieving ? t('callcenter.parked.retrieving') : t('callcenter.parked.retrieve')}
                    </Button>
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
