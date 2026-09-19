import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useCreateKnowledgeBaseMutation, useGetKnowledgeBasesQuery } from '@/features/aiRobots/api/aiToolsApi';

export const AiRobotsKnowledgePage = memo(() => {
  const { t } = useTranslation();
  const { data = [] } = useGetKnowledgeBasesQuery();
  const [create] = useCreateKnowledgeBaseMutation();
  const [name, setName] = useState('Pilot KB');
  return (
    <VStack gap="16" max data-testid="ai-robots-knowledge">
      <Text variant="h1" as="h1">{t('aiRobots.knowledge')}</Text>
      <Text variant="muted">{t('aiRobots.knowledgeHint')}</Text>
      <Input value={name} onChange={(event) => setName(event.target.value)} />
      <Button onClick={() => { void create({ name }); }}>{t('common.create', 'Create')}</Button>
      {data.map((row) => <Text key={row.id}>{row.name}</Text>)}
    </VStack>
  );
});
AiRobotsKnowledgePage.displayName = 'AiRobotsKnowledgePage';
