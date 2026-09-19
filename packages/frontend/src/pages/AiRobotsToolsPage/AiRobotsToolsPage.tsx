import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useCreateAiToolMutation, useGetAiToolsQuery } from '@/features/aiRobots/api/aiToolsApi';

export const AiRobotsToolsPage = memo(() => {
  const { t } = useTranslation();
  const { data = [] } = useGetAiToolsQuery();
  const [create] = useCreateAiToolMutation();
  const [name, setName] = useState('CRM sandbox');
  return (
    <VStack gap="16" max data-testid="ai-robots-tools">
      <Text variant="h1" as="h1">{t('aiRobots.tools')}</Text>
      <Text variant="muted">{t('aiRobots.toolsHint')}</Text>
      <Input value={name} onChange={(event) => setName(event.target.value)} />
      <Button onClick={() => { void create({ name, kind: 'http', destination: 'sandbox://crm' }); }}>
        {t('common.create', 'Create')}
      </Button>
      {data.map((row) => <Text key={row.id}>{row.name}</Text>)}
    </VStack>
  );
});
AiRobotsToolsPage.displayName = 'AiRobotsToolsPage';
