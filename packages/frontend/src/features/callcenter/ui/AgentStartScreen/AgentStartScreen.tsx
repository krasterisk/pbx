import { useTranslation } from 'react-i18next';
import { Text, VStack } from '@/shared/ui';
import { formatCcDuration } from '../../lib/ccFormat';
import {
  ShiftLoginForm,
  type ShiftLoginResult,
} from '../ShiftLoginModal/ShiftLoginForm';
import styles from './AgentStartScreen.module.scss';

export interface LastShiftSummary {
  loginTime?: string;
  logoutTime?: string;
  totalCalls?: number;
  totalTalkSec?: number;
  totalPauseSec?: number;
}

export interface AgentStartScreenProps {
  onConfirm: (result: ShiftLoginResult) => void | Promise<void>;
  /** Closed shift before this login. Hidden when the operator has never finished one. */
  lastShift?: LastShiftSummary | null;
}

function shiftWhen(value: string | undefined, locale: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale.startsWith('ru') ? 'ru-RU' : 'en-GB', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Operator screen outside a shift (U2.1): the shift form inline, one primary "Start shift"
 * button. Coworkers / Queues panels are not shown until the shift starts - the empty panels of an
 * operator who is not on a shift only add noise.
 */
export function AgentStartScreen({ onConfirm, lastShift }: AgentStartScreenProps) {
  const { t, i18n } = useTranslation();
  const when = lastShift ? shiftWhen(lastShift.logoutTime, i18n.language ?? 'ru') : '';
  return (
    <VStack gap="16" max className={styles.screen} data-testid="agent-start-screen">
      <Text variant="muted">
        {t('callcenter.agent.startScreenHint', 'Choose the phone you will answer on and the queues that should send you calls.')}
      </Text>
      {lastShift ? (
        <section className={styles.lastShift} data-testid="agent-last-shift" aria-label={t('callcenter.agent.lastShiftTitle', 'Previous shift')}>
          <Text className={styles.lastShiftTitle}>{t('callcenter.agent.lastShiftTitle', 'Previous shift')}</Text>
          <Text variant="small">
            {[
              when,
              `${t('callcenter.agent.lastShiftCalls', 'Calls')} ${lastShift.totalCalls ?? 0}`,
              `${t('callcenter.agent.lastShiftTalk', 'Talk')} ${formatCcDuration(lastShift.totalTalkSec ?? 0)}`,
              `${t('callcenter.agent.lastShiftPause', 'Pauses')} ${formatCcDuration(lastShift.totalPauseSec ?? 0)}`,
            ].filter(Boolean).join(' · ')}
          </Text>
        </section>
      ) : null}
      <ShiftLoginForm active onConfirm={onConfirm} />
    </VStack>
  );
}
