import { useTranslation } from 'react-i18next';
import { Phone, PhoneOff } from 'lucide-react';
import { Button, Text, HStack, VStack } from '@/shared/ui';
import styles from './IncomingCallToast.module.scss';

export type IncomingCallKind = 'queue' | 'personal' | 'outbound';

export interface IncomingCallContext {
  callerNumber?: string;
  callerName?: string;
  kind: IncomingCallKind;
  /** Display name of the queue, used when kind === 'queue'. */
  queueLabel?: string;
}

export interface IncomingCallToastProps {
  open: boolean;
  call: IncomingCallContext | null;
  onAnswer: () => void;
  onReject: () => void;
}

/**
 * Non-modal incoming-call slide-in (D-02). No backdrop, underlying tabs/lists
 * stay fully interactive - never render this inside Sheet (its overlay blocks
 * the page, forbidden by UI-SPEC Surface 3). No auto-dismiss timer: it closes
 * only via onAnswer/onReject (or the parent unmounting it when the call ends).
 */
export function IncomingCallToast({ open, call, onAnswer, onReject }: IncomingCallToastProps) {
  const { t } = useTranslation();

  if (!open || !call) return null;

  const contextLabel = call.kind === 'queue'
    ? (call.queueLabel || t('callcenter.incoming.fromQueue'))
    : call.kind === 'personal'
      ? t('callcenter.incoming.personal')
      : t('callcenter.incoming.outbound');

  return (
    <div
      className={styles.toast}
      role="alertdialog"
      aria-live="assertive"
      aria-label={t('callcenter.incoming.title')}
      data-testid="incoming-call-toast"
    >
      <VStack gap="8">
        <HStack justify="between" align="start" gap="8">
          <VStack gap="0" className={styles.callerBlock}>
            <Text className={styles.callerNumber}>
              {call.callerNumber || t('callcenter.incoming.unknownCaller')}
            </Text>
            {call.callerName ? (
              <Text variant="muted" className={styles.callerName}>{call.callerName}</Text>
            ) : null}
          </VStack>
          <span className={styles.contextTag}>{contextLabel}</span>
        </HStack>

        <HStack gap="8" className={styles.actions}>
          <Button size="lg" onClick={onAnswer}>
            <Phone className="w-4 h-4 mr-1" />
            {t('callcenter.incoming.answer')}
          </Button>
          <Button variant="destructive" size="lg" onClick={onReject}>
            <PhoneOff className="w-4 h-4 mr-1" />
            {t('callcenter.incoming.reject')}
          </Button>
        </HStack>
      </VStack>
    </div>
  );
}
