import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Button, Flex, HStack, Text, Tooltip } from '@/shared/ui';
import styles from './CcPageHeader.module.scss';

export interface CcPageHeaderProps {
  title: string;
  description?: string;
  data?: 'live' | 'stale' | 'offline' | 'period';
  context?: React.ReactNode;
  actions?: React.ReactNode;
  testId?: string;
}

const DATA_LABEL_KEYS: Record<NonNullable<CcPageHeaderProps['data']>, [string, string]> = {
  live: ['callcenter.header.statusLive', 'Queue on screen'],
  stale: ['callcenter.header.statusStale', 'Queue on screen is late'],
  offline: ['callcenter.header.statusOffline', 'Queue not on screen'],
  period: ['callcenter.header.statusPeriod', 'For a period'],
};

const DATA_HINT_KEYS: Record<NonNullable<CcPageHeaderProps['data']>, [string, string]> = {
  live: ['callcenter.header.statusLiveHint', 'Waiting callers, conversations and statuses appear on this page by themselves. This is not the headset or the phone registration: the softphone shows that.'],
  stale: ['callcenter.header.statusStaleHint', 'Who is waiting and who is talking is late on this page. The phone can still be registered.'],
  offline: ['callcenter.header.statusOfflineHint', 'This page is not receiving who is waiting and who is talking. Reconnecting. This mark does not describe the call in the headset.'],
  period: ['callcenter.header.statusPeriodHint', 'This is a finished period, not the queue as it is right now.'],
};

/**
 * Compact 48 px header for all 5 Call Center screens (U0.3).
 * Replaces the ~90 px badge + subtitle headers; page description lives in a Tooltip.
 */
export function CcPageHeader({
  title,
  description,
  data,
  context,
  actions,
  testId = 'cc-page-header',
}: CcPageHeaderProps) {
  const { t } = useTranslation();

  const statusToneClass =
    data === 'live'
      ? styles.statusLive
      : data === 'stale'
        ? styles.statusStale
        : data === 'offline'
          ? styles.statusOffline
          : '';

  return (
    <Flex
      as="header"
      align="center"
      justify="between"
      gap="12"
      wrap="wrap"
      className={styles.header}
      data-testid={testId}
    >
      <HStack gap="8" align="center" className={styles.titleGroup}>
        <Text as="h1" variant="h1" className={styles.title}>
          {title}
        </Text>
        {description && (
          <Tooltip content={description}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={styles.infoBtn}
              aria-label={t('callcenter.header.infoLabel', 'About this page')}
              data-testid={`${testId}-info`}
            >
              <Info size={15} />
            </Button>
          </Tooltip>
        )}
        {data && (
          <Tooltip content={t(DATA_HINT_KEYS[data][0], DATA_HINT_KEYS[data][1])}>
            <span
              className={`${styles.statusPill} ${statusToneClass}`}
              data-testid={`${testId}-status`}
              data-state={data}
              tabIndex={0}
            >
              <Flex as="span" className={styles.dot} aria-hidden="true" />
              <Text as="span" variant="xs">
                {t(DATA_LABEL_KEYS[data][0], DATA_LABEL_KEYS[data][1])}
              </Text>
            </span>
          </Tooltip>
        )}
      </HStack>

      {context && (
        <HStack gap="8" align="center" wrap="wrap" className={styles.contextSlot} data-testid={`${testId}-context`}>
          {context}
        </HStack>
      )}

      {actions && (
        <HStack gap="8" align="center" wrap="wrap" className={styles.actionsSlot} data-testid={`${testId}-actions`}>
          {actions}
        </HStack>
      )}
    </Flex>
  );
}
