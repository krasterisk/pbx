import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Text, Textarea } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import {
  useAddKnowledgeTextMutation, useCreateKnowledgeBaseMutation, useGetKnowledgeBasesQuery, useQueryKnowledgeMutation,
} from '@/features/aiRobots/api/aiToolsApi';

export const AiRobotsKnowledgePage = memo(() => {
  const { t } = useTranslation();
  const { data = [], isError, refetch } = useGetKnowledgeBasesQuery();
  const [create, { isLoading }] = useCreateKnowledgeBaseMutation();
  const [addText] = useAddKnowledgeTextMutation();
  const [query, { data: hits }] = useQueryKnowledgeMutation();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [text, setText] = useState('');
  const [question, setQuestion] = useState('');
  if (isError) return <QueryErrorState message={t('common.queryLoadError')} onRetry={() => void refetch()} />;
  return (
    <VStack gap="16" max data-testid="ai-robots-knowledge">
      <Text variant="h1" as="h1">{t('aiRobots.knowledge')}</Text>
      <Text variant="muted">{t('aiRobots.knowledgeHint')}</Text>
      <Input aria-label={t('aiVoiceDesigner.name')} value={name} onChange={event => setName(event.target.value)} />
      <Button disabled={isLoading || !name.trim()} onClick={() => { void create({ name }); setName(''); }}>
        {t('common.create', 'Create')}
      </Button>
      {data.map(row => (
        <Button key={row.id} variant={selected === row.id ? 'default' : 'outline'} onClick={() => setSelected(row.id)}>
          {row.name}
        </Button>
      ))}
      <Textarea aria-label={t('aiVoiceDesigner.instruction')} value={text} rows={6} onChange={event => setText(event.target.value)} />
      <Button disabled={!selected || !text.trim()} onClick={() => { void addText({ id: selected, title: name || 'Текст', text }); setText(''); }}>
        {t('common.save')}
      </Button>
      <Input aria-label={t('aiVoiceDesigner.testMessage')} value={question} onChange={event => setQuestion(event.target.value)} />
      <Button disabled={!selected || !question.trim()} onClick={() => { void query({ baseIds: [selected], query: question }); }}>
        {t('aiVoiceDesigner.test')}
      </Button>
      {(hits ?? []).map(hit => <Text key={hit.id} variant="muted">{hit.excerpt}</Text>)}
    </VStack>
  );
});
AiRobotsKnowledgePage.displayName = 'AiRobotsKnowledgePage';
