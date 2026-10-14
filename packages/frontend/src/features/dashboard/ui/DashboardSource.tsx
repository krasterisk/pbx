import { useTranslation } from 'react-i18next';
import type { DashboardSource as Source } from '@krasterisk/shared';
import { HStack, Text, Badge } from '@/shared/ui';
import cls from './Dashboard.module.scss';
export function DashboardSource({
  source,
  timezone = 'UTC',
}: {
  source: Source;
  timezone?: string;
}) {
  const { t, i18n } = useTranslation();
  const updated = source.updatedAt
    ? new Intl.DateTimeFormat(i18n.language, {
        timeZone: timezone,
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date(source.updatedAt))
    : null;
  const age = source.updatedAt
    ? Math.max(0, Math.floor((Date.now() - Date.parse(source.updatedAt)) / 1000))
    : null;
  const rawProgress = source.state !== 'ok' ? source.progress?.percent : null;
  const progress =
    rawProgress != null && Number.isFinite(rawProgress)
      ? Math.round(Math.max(0, Math.min(100, rawProgress)))
      : null;
  return (
    <HStack wrap="wrap" gap="8" role="status" className={cls.source}>
      <Badge className={source.state === 'ok' ? cls.sourceHealthy : undefined} variant="secondary">
        {t('dashboard.source.' + source.state)}
      </Badge>
      {updated && <Text variant="xs">{t('dashboard.updatedAt', { time: updated })}</Text>}
      {age !== null && source.state !== 'ok' && (
        <Text variant="xs">{t('dashboard.dataAge', { count: age })}</Text>
      )}
      {progress !== null && (
        <Text
          variant="xs"
          role="progressbar"
          aria-label={t('dashboard.historyLoading')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          {t('dashboard.historyProgress', { percent: progress })}
        </Text>
      )}
      {source.message && (
        <Text variant="xs">
          {t('dashboard.sourceMessage.' + source.message, { defaultValue: source.message })}
        </Text>
      )}
    </HStack>
  );
}
