import { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Search, CheckCircle, XCircle, Clock } from 'lucide-react';
import { VStack, HStack, Input, Button, Text, Label } from '@/shared/ui';
import { useTestMatchVoiceRobotMutation } from '@/shared/api/endpoints/voiceRobotsApi';
import cls from './TestMatchPanel.module.scss';

interface TestMatchPanelProps {
  robotId: number;
}

interface MatchHistoryItem {
  text: string;
  matched: boolean;
  keyword?: string;
  confidence?: number;
  method?: string;
  elapsedMs: number;
}

/**
 * TestMatchPanel — interactive test panel for keyword matching.
 *
 * Sends text to POST /voice-robots/:id/test-match and displays
 * the matching result with confidence, method, and timing info.
 *
 * FSD layer: features/voiceRobots/ui
 */
export const TestMatchPanel = memo(({ robotId }: TestMatchPanelProps) => {
  const { t } = useTranslation();
  const [testMatch, { isLoading }] = useTestMatchVoiceRobotMutation();

  const [inputText, setInputText] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);

  const handleTest = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;

    try {
      const result = await testMatch({ robotId, text: inputText.trim() }).unwrap();
      setLastResult(result);

      setHistory(prev => [{
        text: inputText.trim(),
        matched: !!result.match,
        keyword: result.match?.keyword_text,
        confidence: result.match?.confidence,
        method: result.match?.method,
        elapsedMs: result.elapsed_ms,
      }, ...prev].slice(0, 20));

      setInputText('');
    } catch (err) {
      console.error('Test match failed:', err);
    }
  }, [inputText, robotId, testMatch, isLoading]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTest();
  }, [handleTest]);

  const getConfidenceClass = (conf: number): string => {
    if (conf >= 0.8) return cls.confidenceHigh;
    if (conf >= 0.5) return cls.confidenceMedium;
    return cls.confidenceLow;
  };

  return (
    <VStack gap="12" className={cls.testPanel}>
      <HStack gap="4" align="center">
        <Zap size={16} className="text-primary" />
        <Text className="text-sm font-semibold">
          {t('voiceRobots.testPanel.title', 'Тест распознавания')}
        </Text>
      </HStack>

      {/* Input */}
      <HStack gap="8" className={cls.inputRow}>
        <VStack gap="4" className="flex-1">
          <Label>{t('voiceRobots.testPanel.inputLabel', 'Текст (имитация STT)')}</Label>
          <Input
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('voiceRobots.testPanel.placeholder', 'мне нужна помощь специалиста')}
          />
        </VStack>
        <Button onClick={handleTest} disabled={isLoading || !inputText.trim()}>
          <Search size={14} />
          <Text>{t('voiceRobots.testPanel.test', 'Тест')}</Text>
        </Button>
      </HStack>

      {/* Last result */}
      {lastResult && (
        <VStack
          gap="8"
          className={`${cls.resultCard} ${lastResult.match ? cls.matchFound : cls.noMatch}`}
        >
          <HStack gap="8" align="center">
            {lastResult.match ? (
              <CheckCircle size={18} className="text-green-500" />
            ) : (
              <XCircle size={18} className="text-red-500" />
            )}
            <Text className="font-semibold">
              {lastResult.match
                ? t('voiceRobots.testPanel.matched', 'Совпадение найдено')
                : t('voiceRobots.testPanel.noMatch', 'Совпадений не найдено')}
            </Text>
          </HStack>

          {lastResult.match && (
            <VStack gap="4">
              <HStack gap="8" align="center">
                <Text className="text-sm">
                  {t('voiceRobots.testPanel.keyword', 'Ключевая фраза')}: <strong>{lastResult.match.keyword_text}</strong>
                </Text>
              </HStack>

              <HStack gap="8" align="center">
                <Text className={`${cls.confidenceBadge} ${getConfidenceClass(lastResult.match.confidence)}`}>
                  {(lastResult.match.confidence * 100).toFixed(1)}%
                </Text>
                <Text className={cls.methodBadge}>
                  {lastResult.match.method}
                </Text>
                <HStack gap="4" align="center" className={cls.elapsedTime}>
                  <Clock size={12} />
                  <Text>{lastResult.elapsed_ms}ms</Text>
                </HStack>
              </HStack>

              <Text className="text-xs text-muted-foreground">
                {t('voiceRobots.testPanel.matchedPhrase', 'Фраза-триггер')}: &quot;{lastResult.match.matched_phrase}&quot;
                {' · '}
                {t('voiceRobots.testPanel.totalKeywords', 'Всего ключевых слов')}: {lastResult.total_keywords}
              </Text>
            </VStack>
          )}

          {!lastResult.match && (
            <Text className="text-xs text-muted-foreground">
              {t('voiceRobots.testPanel.totalKeywords', 'Всего ключевых слов')}: {lastResult.total_keywords}
              {' · '}
              <Clock size={12} className="inline" /> {lastResult.elapsed_ms}ms
            </Text>
          )}
        </VStack>
      )}

      {/* History */}
      {history.length > 0 && (
        <VStack gap="4">
          <Label className="text-xs text-muted-foreground">
            {t('voiceRobots.testPanel.history', 'История тестов')}
          </Label>
          <VStack className={cls.history}>
            {history.map((item, idx) => (
              <HStack key={idx} gap="8" align="center" className={cls.historyItem}>
                {item.matched ? (
                  <CheckCircle size={14} className="text-green-500 shrink-0" />
                ) : (
                  <XCircle size={14} className="text-red-500 shrink-0" />
                )}
                <Text className="text-sm flex-1">&quot;{item.text}&quot;</Text>
                {item.matched && item.confidence && (
                  <Text className={`${cls.confidenceBadge} ${getConfidenceClass(item.confidence)}`}>
                    {(item.confidence * 100).toFixed(0)}%
                  </Text>
                )}
                <Text className={cls.elapsedTime}>{item.elapsedMs}ms</Text>
              </HStack>
            ))}
          </VStack>
        </VStack>
      )}
    </VStack>
  );
});

TestMatchPanel.displayName = 'TestMatchPanel';
