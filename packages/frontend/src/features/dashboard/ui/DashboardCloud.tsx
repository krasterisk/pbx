import { useTranslation } from 'react-i18next';
import type { DashboardCloud as Cloud, DashboardLive } from '@krasterisk/shared';
import { Text, VStack, HStack, Badge } from '@/shared/ui';
import { DashboardSource } from './DashboardSource';
import { hasDashboardValue } from '../model/dashboardView';
import cls from './Dashboard.module.scss';

export function money(value: number | null, language: string) {
  return value === null
    ? null
    : new Intl.NumberFormat(language, { style: 'currency', currency: 'RUB' }).format(value / 100);
}
export function DashboardCloud({
  cloud,
  timezone,
  live,
}: {
  cloud: Cloud;
  timezone: string;
  live?: DashboardLive;
}) {
  const { t, i18n } = useTranslation();
  const known = hasDashboardValue(cloud.source);
  const billingKnown = known && hasDashboardValue(cloud.billingSource ?? cloud.source);
  return (
    <VStack gap="16" align="stretch" max>
      <DashboardSource source={cloud.source} timezone={timezone} />
      {cloud.billingSource && cloud.billingSource.state !== 'ok' && (
        <DashboardSource source={cloud.billingSource} timezone={timezone} />
      )}
      <VStack gap="8" align="start" className={cls.detailHero}>
        <Text variant="muted">{t('dashboard.plan')}</Text>
        <Text variant="h3" className={cls.detailTitle}>
          {known ? cloud.planName || t('dashboard.planUnset') : t('dashboard.noData')}
        </Text>
        <Text variant="muted">
          {cloud.expiresAt
            ? t('dashboard.planExpires', {
                date: new Intl.DateTimeFormat(i18n.language, {
                  timeZone: timezone,
                  dateStyle: 'medium',
                }).format(new Date(cloud.expiresAt)),
              })
            : t('dashboard.expiryUnknown')}
        </Text>
      </VStack>
      <HStack className={cls.detailGrid}>
        <VStack gap="12" align="start" className={cls.detailRow}>
          <Text variant="muted">{t('dashboard.balance')}</Text>
          <Text className={cls.value}>
            {billingKnown
              ? (money(cloud.balanceKopecks, i18n.language) ?? t('dashboard.noData'))
              : t('dashboard.noData')}
          </Text>
        </VStack>
        <VStack gap="12" align="start" className={cls.detailRow}>
          <Text variant="muted">{t('dashboard.availableBalance')}</Text>
          <Text className={cls.value}>
            {billingKnown && cloud.balanceKopecks !== null && cloud.creditLimitKopecks !== null
              ? money(cloud.balanceKopecks + cloud.creditLimitKopecks, i18n.language)
              : t('dashboard.noData')}
          </Text>
        </VStack>
      </HStack>
      <Text variant="muted">
        {t('dashboard.creditLimit')}:{' '}
        {billingKnown
          ? (money(cloud.creditLimitKopecks, i18n.language) ?? t('dashboard.noData'))
          : t('dashboard.noData')}
      </Text>
      {billingKnown && (
        <Badge variant={cloud.blocked ? 'destructive' : 'secondary'}>
          {t(cloud.blocked ? 'dashboard.billingBlocked' : 'dashboard.billingActive')}
        </Badge>
      )}
      <VStack gap="12" align="stretch">
        <Text variant="h4">{t('dashboard.moreLimits')}</Text>
        {(['extensions', 'trunks', 'queues', 'concurrentCalls'] as const).map((key) => (
          <HStack key={key} justify="between" wrap="wrap" className={cls.detailRow}>
            <Text>{t('dashboard.limit.' + key)}</Text>
            <Text>
              {known &&
              hasDashboardValue(
                key === 'queues'
                  ? cloud.source
                  : key === 'concurrentCalls'
                    ? (live?.callsSource ?? live?.source ?? cloud.usageSource ?? cloud.source)
                    : (live?.inventorySource ?? live?.source ?? cloud.usageSource ?? cloud.source),
              )
                ? cloud.usage[key].toLocaleString(i18n.language)
                : t('dashboard.noData')}{' '}
              /{' '}
              {known && cloud.limits[key] !== null
                ? cloud.limits[key]?.toLocaleString(i18n.language)
                : t('dashboard.limitUnknown')}
            </Text>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}
