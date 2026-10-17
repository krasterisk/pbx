import { useTranslation } from 'react-i18next';
import { Badge, Button, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetAutodialPreflightQuery } from '@/shared/api/endpoints/autodialApi';
import type { IAutodialPreflight } from '@krasterisk/shared';

export function PreflightChecks({ data }: { data: IAutodialPreflight }) {
  const { t } = useTranslation();
  return <VStack gap="8" max>
    <Text>{t('autodial.workspace.eligible', { count: data.eligible_numbers })}</Text>
    {data.checks.map((check) => <HStack key={check.id} gap="8" align="start">
      <Badge variant={check.status === 'fail' ? 'destructive' : check.status === 'warning' ? 'outline' : 'secondary'}>
        {t(`autodial.workspace.checkStatus.${check.status}`)}
      </Badge>
      <VStack gap="4"><Text>{t(`autodial.workspace.checks.${check.code}`, { defaultValue: check.code })}</Text>
        {check.detail && <Text variant="muted">{check.detail}</Text>}
      </VStack>
    </HStack>)}
    <Text variant="muted">{t('autodial.workspace.checkedAt', { time: new Date(data.checked_at).toLocaleString() })}</Text>
  </VStack>;
}

export function PreflightChecklist({ uid }: { uid: number }) {
  const { t } = useTranslation();
  const { currentData, isFetching, isError, refetch } = useGetAutodialPreflightQuery(uid);
  return <VStack gap="12" max>
    <Text variant="h3">{t('autodial.workspace.preflight')}</Text>
    {isError && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
    {currentData && <PreflightChecks data={currentData} />}
    <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>{t('autodial.workspace.recheck')}</Button>
  </VStack>;
}
