import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ParkingCircle, X, PhoneCall } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import {
  useGetParkedCallsQuery,
  useRetrieveParkedCallMutation,
} from '@/shared/api/endpoints/callCenterApi';
import styles from './ParkedCallsIndicator.module.scss';
import { toast } from 'react-toastify';

/**
 * Tenant-wide parking lot indicator (D-28) - badge + dropdown, mirrors
 * MissedCallsPanel's shape 1:1 but with an info-tint (neutral, not a
 * warning) and a per-entry Retrieve action. Auto-refreshes via the
 * ParkedCalls RTK cache tag, invalidated on any operator's park/retrieve
 * through the parkedCallsUpdate SSE event (useCallCenterSSE.ts).
 * Hidden when the lot is empty.
 */
export function ParkedCallsIndicator({
  showLabel = false,
}: { showLabel?: boolean } = {}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [failureStatus, setFailureStatus] = useState<string | null>(null);
  const [pageVisible, setPageVisible] = useState(
    () => document.visibilityState !== 'hidden',
  );

  const {
    data: parked = [],
    isError,
    isSuccess,
    isFetching,
    error,
    refetch,
  } = useGetParkedCallsQuery(undefined, {
    pollingInterval: pageVisible
      ? failureStatus === '429'
        ? 60000
        : 30000
      : 0,
  });
  const currentFailure = isError
    ? error && 'status' in error
      ? String(error.status)
      : 'ERROR'
    : null;
  const displayedFailure = currentFailure ?? failureStatus;
  useEffect(() => {
    if (currentFailure) setFailureStatus(currentFailure);
    else if (isSuccess && !isFetching) setFailureStatus(null);
  }, [currentFailure, isSuccess, isFetching]);
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const [retrieveParkedCall, { isLoading: isRetrieving }] =
    useRetrieveParkedCallMutation();

  const handleRetrieve = async (parkingSpace: string) => {
    try {
      await retrieveParkedCall({ parkingSpace }).unwrap();
    } catch {
      toast.error(
        t(
          'callcenter.parked.retrieveError',
          'Could not retrieve the parked call. Refresh the list and try again.',
        ),
      );
    }
  };

  const count = parked.length;
  if (count === 0 && !displayedFailure && !open) return null;

  return (
    <div className={styles.wrap}>
      <Button
        type="button"
        variant="unstyled"
        size="none"
        className={`${styles.badge}${showLabel ? ` ${styles.badgeLabeled}` : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={t('callcenter.parked.title')}
        aria-label={t('callcenter.parked.title')}
        aria-expanded={open}
      >
        <ParkingCircle className={showLabel ? 'w-5 h-5' : 'w-4 h-4'} />
        {showLabel ? (
          <span className={styles.badgeLabel}>
            {t('callcenter.parked.title')}
          </span>
        ) : null}
        <span className={styles.count}>{displayedFailure ? '!' : count}</span>
      </Button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <Text className={styles.title}>
              <ParkingCircle className="w-4 h-4 inline mr-1.5" />
              {t('callcenter.parked.title')}
            </Text>
            <Button
              type="button"
              variant="unstyled"
              size="none"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className={styles.list}>
            {displayedFailure && (
              <div
                className={styles.row}
                role="alert"
                data-error-status={displayedFailure}
              >
                <Text>
                  {displayedFailure === '429'
                    ? t(
                        'callcenter.parked.rateLimited',
                        'Parking checks are temporarily limited. We will retry automatically.',
                      )
                    : t(
                        'callcenter.parked.loadError',
                        'Could not check parked calls',
                      )}
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isFetching}
                  onClick={() => void refetch()}
                >
                  {t('common.retry', 'Retry')}
                </Button>
              </div>
            )}
            {!displayedFailure && count === 0 && (
              <Text variant="muted" role="status">
                {t('callcenter.parked.empty', 'No parked calls')}
              </Text>
            )}
            {parked.map((p) => (
              <div key={p.parkingSpace} className={styles.row}>
                <div className={styles.rowMain}>
                  <Text className={styles.rowNum}>
                    {p.callerIdNum || t('callcenter.missed.unknown')}
                  </Text>
                  {p.callerIdName && (
                    <Text variant="muted" className="text-xs">
                      {p.callerIdName}
                    </Text>
                  )}
                  <Text variant="muted" className="text-xs">
                    {t('callcenter.parked.spaceLabel', 'Space {{space}}', {
                      space: p.parkingSpace,
                    })}
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
                    {isRetrieving
                      ? t('callcenter.parked.retrieving')
                      : t('callcenter.parked.retrieve')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
