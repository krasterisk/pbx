import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useGetAiVoiceSessionsQuery, useGetAiVoiceTimelineQuery } from '../api/aiVoiceApi';

export const SessionJournal = memo(() => {
  const { t } = useTranslation();
  const { data: sessions = [] } = useGetAiVoiceSessionsQuery();
  const [selected, setSelected] = useState('');
  const { data: timeline } = useGetAiVoiceTimelineQuery(selected, { skip: !selected });

  return (
    <VStack gap="16" max data-testid="ai-robots-sessions">
      <Text variant="h1" as="h1">{t('aiRobots.sessions')}</Text>
      {sessions.length === 0 ? (
        <Text variant="muted">{t('aiRobots.emptySessions')}</Text>
      ) : sessions.map((row) => (
        <Card key={row.id}>
          <CardHeader>
            <CardTitle>
              <button type="button" onClick={() => setSelected(row.id)}>
                {row.id}
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Text variant="muted">{row.state} · {row.ingress_kind} · {row.started_at}</Text>
          </CardContent>
        </Card>
      ))}
      {timeline ? (
        <VStack gap="8" data-testid="ai-robots-timeline">
          {timeline.turns.map((turn) => (
            <Text key={turn.id} variant="muted">
              {turn.role} t{turn.input_turn_id}/e{turn.output_epoch} {turn.state}: {turn.text}
            </Text>
          ))}
        </VStack>
      ) : null}
    </VStack>
  );
});

SessionJournal.displayName = 'SessionJournal';
