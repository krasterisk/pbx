import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useDispatch } from 'react-redux';
import { PhoneCall } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import type { CallbackSource, CallbackStatus } from '@krasterisk/shared';
import {
  useCancelCallbackRequestMutation,
  useClaimCallbackRequestMutation,
  type ICallbackRequest,
} from '@/shared/api/endpoints/callbackRequestsApi';
import { useCallbackMissedCallMutation } from '@/shared/api/endpoints/callCenterApi';
import { requestOutboundDial } from '@/features/callcenter/model/slice/callCenterSlice';
import styles from './CallbackRequestsList.module.scss';

const STATUS_KEY: Record<CallbackStatus, string> = {
  pending: 'statusPending',
  dialing: 'statusDialing',
  completed: 'statusCompleted',
  failed: 'statusFailed',
  cancelled: 'statusCancelled',
  expired: 'statusExpired',
};

const SOURCE_KEY: Record<CallbackSource, string> = {
  route_step: 'sourceRoute',
  queue_dtmf: 'sourceQueueDtmf',
  queue_abandon: 'sourceQueueAbandon',
};

export function isCallbackUrgent(row: ICallbackRequest, now = Date.now()): boolean {
  if (row.status === 'failed' || row.status === 'expired') return true;
  if ((row.status === 'pending' || row.status === 'dialing') && row.next_attempt_at) {
    return new Date(row.next_attempt_at).getTime() < now;
  }
  return false;
}

function fmtAgo(iso: string, t: (key: string, fallback?: string) => string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return t('callcenter.missed.justNow', 'just now');
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function fmtClock(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function CallbackRequestsList({
  rows,
  allowActions = true,
}: {
  rows: ICallbackRequest[];
  allowActions?: boolean;
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [claim] = useClaimCallbackRequestMutation();
  const [cancel] = useCancelCallbackRequestMutation();
  const [callbackMissed, { isLoading: isCalling }] = useCallbackMissedCallMutation();

  const handleCallNow = async (row: ICallbackRequest) => {
    try {
      if (row.claimed_agent_uid == null) {
        await claim(row.id).unwrap();
      }
      const res = await callbackMissed({ callerIdNum: row.caller }).unwrap();
      if (res.mode === 'webrtc' && res.target) {
        dispatch(requestOutboundDial(res.target));
      }
    } catch (err) {
      const status = typeof err === 'object' && err && 'status' in err
        ? Number((err as { status?: number }).status)
        : 0;
      toast.error(
        status === 409
          ? t('callcenter.callback.alreadyClaimed', 'Another agent is already handling this request')
          : t('callcenter.callback.callFailed', 'Could not start dialling, the request stays in the queue'),
      );
    }
  };

  const handleCancel = async (row: ICallbackRequest) => {
    const ok = window.confirm(
      t(
        'callcenter.callback.cancelConfirm',
        'Cancel the request: nobody will call {{number}} back. Continue?',
      ).replace('{{number}}', row.caller),
    );
    if (!ok) return;
    try {
      await cancel(row.id).unwrap();
    } catch {
      toast.error(t('common.saveFailed', 'Save failed'));
    }
  };

  if (rows.length === 0) {
    return (
      <div className={styles.empty} data-testid="callback-requests-empty">
        <Text className={styles.rowNum}>{t('callcenter.callback.emptyTitle', 'No callback requests')}</Text>
        <Text variant="muted">
          {t(
            'callcenter.callback.emptyBody',
            'Requests appear here once a caller asks for a callback',
          )}
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.list} data-testid="callback-requests-list">
      {rows.map((row) => {
        const next = fmtClock(row.next_attempt_at);
        const waitingWindow = row.status === 'pending' && next && new Date(row.next_attempt_at ?? 0).getTime() > Date.now();
        return (
          <div key={row.id} className={styles.row} data-testid={`callback-request-${row.id}`}>
            <div className={styles.rowMain}>
              <Text className={styles.rowNum}>{row.caller}</Text>
              <div className={styles.meta}>
                <span className={styles.status}>
                  {t(`callcenter.callback.${STATUS_KEY[row.status]}`, row.status)}
                </span>
                <span className={styles.chip}>
                  {row.queue_label
                    || row.route_label
                    || t(`callcenter.callback.${SOURCE_KEY[row.source]}`, row.source)}
                </span>
                <Text variant="muted" className="text-xs">{fmtAgo(row.created_at, t)}</Text>
              </div>
              <Text variant="muted" className="text-xs">
                {t('callcenter.callback.attemptOf', 'Attempt {{current}} of {{total}}')
                  .replace('{{current}}', String(row.attempt_count))
                  .replace('{{total}}', String(row.max_attempts))}
              </Text>
              {row.attempt_count >= row.max_attempts ? (
                <Text variant="muted" className="text-xs">
                  {t('callcenter.callback.noAttemptsLeft', 'No attempts left')}
                </Text>
              ) : next ? (
                <Text variant="muted" className="text-xs">
                  {waitingWindow
                    ? t('callcenter.callback.waitingWindow', 'Waiting for the dial window to open at {{time}}').replace('{{time}}', next)
                    : t('callcenter.callback.nextAttempt', 'Next attempt at {{time}}').replace('{{time}}', next)}
                </Text>
              ) : null}
            </div>
            {allowActions && (row.status === 'pending' || row.status === 'dialing') && (
              <div className={styles.rowActions}>
                <Button size="sm" disabled={isCalling} onClick={() => handleCallNow(row)}>
                  <PhoneCall className="w-3.5 h-3.5 mr-1" />
                  {t('callcenter.callback.callNow', 'Call now')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleCancel(row)}>
                  {t('callcenter.callback.cancel', 'Cancel the request')}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
