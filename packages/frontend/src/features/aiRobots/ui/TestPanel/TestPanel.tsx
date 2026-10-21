import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import type { AiVoiceRobotConfig } from '@krasterisk/shared';
import { Button, Text, Textarea } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { usePlayAiVoiceRobotMutation } from '@/shared/api/endpoints/aiVoiceRobotsApi';

interface Turn { role: 'user' | 'assistant'; text: string; detail?: string }

export function TestPanel({ config, uid }: { config: AiVoiceRobotConfig; uid?: number }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [outcome, setOutcome] = useState('');
  const [play, { isLoading }] = usePlayAiVoiceRobotMutation();

  const send = async () => {
    const userText = text.trim();
    if (!userText || isLoading) return;
    setText('');
    setTurns(current => [...current, { role: 'user', text: userText }]);
    try {
      const result = await play({
        uid, config, userText,
        history: turns.map(turn => ({ role: turn.role, content: turn.text })),
      }).unwrap();
      const detail = result.toolCalls.map(call => call.name).join(', ');
      setTurns(current => [...current, { role: 'assistant', text: result.assistant, detail }]);
      setOutcome(result.outcome);
    } catch {
      toast.error(t('aiVoiceDesigner.providerUnavailable'));
    }
  };

  return (
    <VStack gap="12" max data-testid="ai-robot-test">
      <Text variant="h2" as="h2">{t('aiVoiceDesigner.test')}</Text>
      <Text variant="muted">{t('aiVoiceDesigner.testHint')}</Text>
      {turns.length === 0 ? <Text variant="muted">{t('aiVoiceDesigner.testEmpty')}</Text> : turns.map((turn, index) => (
        <VStack key={`${turn.role}-${index}`} gap="4">
          <Text>{turn.role === 'user' ? turn.text : turn.text}</Text>
          {turn.detail ? <Text variant="muted">{turn.detail}</Text> : null}
        </VStack>
      ))}
      {outcome ? <Text variant="muted">{t('aiVoiceDesigner.testOutcome')}: {outcome}</Text> : null}
      <Textarea aria-label={t('aiVoiceDesigner.testMessage')} value={text} rows={3}
        onChange={event => setText(event.target.value)} />
      <Button onClick={() => void send()} disabled={isLoading || !text.trim()}>{t('aiVoiceDesigner.testSend')}</Button>
    </VStack>
  );
}
