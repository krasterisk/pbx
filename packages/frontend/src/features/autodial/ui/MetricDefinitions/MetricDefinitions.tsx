import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import cls from './MetricDefinitions.module.scss';

export function MetricDefinitions({ timezone, from, to }: { timezone?: string; from?: string; to?: string }) {
  const { t } = useTranslation();
  return <details className={cls.panel}>
    <summary>{t('autodial.workspace.metrics.title')}</summary>
    <VStack gap="8" max className={cls.content}>
      {timezone && <Text>{t('autodial.workspace.reportTimezone', { timezone })}{from && to ? ` · ${from} — ${to}` : ''}</Text>}
      {(['attempt', 'answer', 'client', 'technical', 'business', 'identity', 'talk', 'sample'] as const).map((key) => <Text key={key}>{t(`autodial.workspace.metrics.${key}`)}</Text>)}
    </VStack>
  </details>;
}
