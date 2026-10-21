import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useCreateAiToolMutation, useGetAiToolsQuery } from '@/features/aiRobots/api/aiToolsApi';

export const AiRobotsToolsPage = memo(() => {
  const { t } = useTranslation();
  const { data = [], isError, refetch } = useGetAiToolsQuery();
  const [create, { isLoading }] = useCreateAiToolMutation();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('http');
  const [destination, setDestination] = useState('https://');
  if (isError) return <QueryErrorState message={t('common.queryLoadError')} onRetry={() => void refetch()} />;
  return (
    <VStack gap="16" max data-testid="ai-robots-tools">
      <Text variant="h1" as="h1">{t('aiRobots.tools')}</Text>
      <Text variant="muted">{t('aiRobots.toolsHint')}</Text>
      <Input aria-label={t('aiVoiceDesigner.name')} value={name} onChange={event => setName(event.target.value)} />
      <Select aria-label={t('aiVoiceDesigner.tools')} value={kind} onChange={event => setKind(event.target.value)}>
        <option value="http">HTTP</option>
        <option value="mcp">MCP</option>
      </Select>
      <Input aria-label="URL" value={destination} onChange={event => setDestination(event.target.value)} />
      <Button disabled={isLoading || !name.trim()} onClick={() => { void create({ name, kind, destination }); setName(''); }}>
        {t('common.create', 'Create')}
      </Button>
      {data.map(row => <Text key={row.id}>{row.name} · {row.kind} · {row.status}</Text>)}
    </VStack>
  );
});
AiRobotsToolsPage.displayName = 'AiRobotsToolsPage';
