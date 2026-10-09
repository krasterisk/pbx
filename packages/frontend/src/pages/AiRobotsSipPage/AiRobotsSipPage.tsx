import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useCreateAiSipConnectionMutation, useGetAiSipConnectionsQuery } from '@/features/aiRobots/api/aiVoiceApi';

export const AiRobotsSipPage = memo(() => {
  const { t } = useTranslation();
  const { data = [], isError: isListLoadError, refetch: retryListLoad } = useGetAiSipConnectionsQuery();
  const [create] = useCreateAiSipConnectionMutation();
  const [name, setName] = useState('External PBX');
  if (isListLoadError) return <QueryErrorState message={t('common.queryLoadError')} onRetry={() => void retryListLoad()} />;
  return (
    <VStack gap="16" max data-testid="ai-robots-sip">
      <Text variant="h1" as="h1">{t('aiRobots.sip')}</Text>
      <Text variant="muted">{t('aiRobots.sipHint')}</Text>
      <Input value={name} onChange={(event) => setName(event.target.value)} />
      <Button onClick={() => { void create({ name, transport: 'tls' }); }}>{t('common.create', 'Create')}</Button>
      {data.map((row) => <Text key={row.id}>{row.name} ({row.status})</Text>)}
    </VStack>
  );
});
AiRobotsSipPage.displayName = 'AiRobotsSipPage';
