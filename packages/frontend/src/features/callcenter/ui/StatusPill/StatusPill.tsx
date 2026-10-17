import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Clock,
  Pause,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { HStack, Text } from '@/shared/ui';
import type { AgentStatus } from '../../model/types/callCenterSchema';
import {
  agentStatusColorFamily,
  agentStatusLabel,
  type AgentStatusColorFamily,
} from '../../lib/displayLabels';
import styles from './StatusPill.module.scss';

const STATUS_ICONS: Record<AgentStatus, LucideIcon> = {
  READY: CheckCircle2,
  IN_CALL: PhoneCall,
  RINGING: PhoneIncoming,
  DIALING: PhoneOutgoing,
  OUTBOUND_WORK: PhoneOutgoing,
  PAUSED: Pause,
  WRAPUP: Clock,
  ACW: Clock,
  CONSULT: Users,
  OFFLINE: CircleOff,
};

export interface StatusPillProps {
  status: AgentStatus;
  phoneOnline?: boolean;
  /** Override label (e.g. rich coworker activity or pause reason). */
  label?: string;
  /** True when agent has an open shift but is detached from Asterisk queues. */
  queuesDetached?: boolean;
  /** Optional ticking timer element rendered after `·`. */
  timer?: React.ReactNode;
  /** True when time in status exceeds the configured limit. */
  overrun?: boolean;
  className?: string;
  testId?: string;
}

const FAMILY_CLASS: Record<AgentStatusColorFamily, string> = {
  success: styles.success,
  warning: styles.warning,
  destructive: styles.destructive,
  info: styles.info,
  muted: styles.muted,
};

/**
 * Accessible status indicator (U0.6): pairs a distinct Lucide icon + text + color family
 * so color is never the sole carrier of meaning.
 */
export function StatusPill({
  status,
  phoneOnline,
  label,
  queuesDetached = false,
  timer,
  overrun = false,
  className,
  testId = 'cc-status-pill',
}: StatusPillProps) {
  const { t } = useTranslation();
  const translate = (key: string, fallback?: string) => t(key, fallback ?? key);

  const unavailable = status === 'READY' && phoneOnline === false;
  const family: AgentStatusColorFamily = unavailable ? 'warning' : overrun
    ? 'destructive'
    : queuesDetached
      ? 'warning'
      : agentStatusColorFamily(status);
  const Icon: LucideIcon = queuesDetached || unavailable
    ? AlertTriangle
    : STATUS_ICONS[status] ?? CircleOff;
  const resolvedLabel = unavailable
    ? t('callcenter.status.phoneUnavailable', 'Phone unavailable · cannot receive calls')
    : queuesDetached
    ? t('callcenter.supervisor.queuesDetached', 'Outside queues')
    : label || agentStatusLabel(status, translate);

  return (
    <HStack
      as="span"
      gap="6"
      align="center"
      className={`${styles.pill} ${FAMILY_CLASS[family]} ${className ?? ''}`.trim()}
      data-testid={testId}
      data-status={queuesDetached ? 'DETACHED' : status}
      data-overrun={overrun ? 'true' : undefined}
    >
      <Icon size={13} className={styles.icon} aria-hidden="true" />
      <Text as="span" variant="xs">
        {resolvedLabel}
      </Text>
      {timer != null && (
        <Text
          as="span"
          variant="xs"
          className={`${styles.timer} ${overrun ? styles.timerOverrun : ''}`.trim()}
        >
          {'· '}
          {timer}
        </Text>
      )}
    </HStack>
  );
}
