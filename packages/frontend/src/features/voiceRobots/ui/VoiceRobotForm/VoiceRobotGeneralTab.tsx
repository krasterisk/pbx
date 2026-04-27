import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { VStack, HStack, Flex, Input, Label, Text, Select, Checkbox, Textarea, Button } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { IVoiceRobotBotAction } from '@/entities/voiceRobot';
import { VoiceRobotActionEditor } from '../VoiceRobotActionEditor/VoiceRobotActionEditor';
import { useGetVoiceRobotKeywordGroupsQuery } from '@/shared/api/endpoints/voiceRobotsApi';

const DEFAULT_FALLBACK_ACTION: IVoiceRobotBotAction = {
  response: { type: 'tts', value: '' },
  nextState: { type: 'listen' },
};

interface VoiceRobotGeneralTabProps {
  name: string;
  setName: (v: string) => void;
  active: boolean;
  setActive: (v: boolean) => void;
  description: string;
  setDescription: (v: string) => void;
  ttsId: number;
  setTtsId: (v: number) => void;
  sttId: number;
  setSttId: (v: number) => void;
  language: string;
  setLanguage: (v: string) => void;
  greetingText: string;
  setGreetingText: (v: string) => void;
  initialGroupId: number | null;
  setInitialGroupId: (v: number | null) => void;
  robotId: number | null;
  maxSteps: number;
  setMaxSteps: (v: number) => void;
  silenceTimeoutSeconds: number;
  setSilenceTimeoutSeconds: (v: number) => void;
  fallbackBotAction: IVoiceRobotBotAction;
  setFallbackBotAction: (v: IVoiceRobotBotAction) => void;
  maxInactivityRepeats: number;
  setMaxInactivityRepeats: (v: number) => void;
  maxRetriesBotAction: IVoiceRobotBotAction;
  setMaxRetriesBotAction: (v: IVoiceRobotBotAction) => void;
  ttsEngines?: any[];
  sttEngines?: any[];
}

/**
 * VoiceRobotGeneralTab — main settings tab for voice robot.
 *
 * Contains: name, description, TTS/STT engines, language, greeting,
 * and error handling section (max steps, silence timeout, fallback action, max retries action).
 *
 * FSD layer: features/voiceRobots/ui
 */
export const VoiceRobotGeneralTab = memo(({
  name, setName, active, setActive,
  description, setDescription,
  ttsId, setTtsId, sttId, setSttId,
  language, setLanguage,
  greetingText, setGreetingText,
  initialGroupId, setInitialGroupId,
  robotId,
  maxSteps, setMaxSteps,
  silenceTimeoutSeconds, setSilenceTimeoutSeconds,
  fallbackBotAction, setFallbackBotAction,
  maxInactivityRepeats, setMaxInactivityRepeats,
  maxRetriesBotAction, setMaxRetriesBotAction,
  ttsEngines, sttEngines,
}: VoiceRobotGeneralTabProps) => {
  const { t } = useTranslation();
  const [showFallback, setShowFallback] = useState(false);
  const [showMaxRetries, setShowMaxRetries] = useState(false);

  const { data: keywordGroups = [] } = useGetVoiceRobotKeywordGroupsQuery(
    robotId ?? 0,
    { skip: !robotId },
  );

  return (
    <VStack gap="16">
      {/* Active toggle */}
      <HStack gap="12" align="center" className="border border-border p-3 rounded bg-background w-full">
        <Label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />
          <Text variant="small">{t('common.active', 'Активен')}</Text>
        </Label>
      </HStack>

      {/* Name + Description */}
      <HStack gap="16">
        <VStack gap="4" className="flex-1">
          <Label>{t('voiceRobots.nameField', 'Имя робота')}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Support Bot" />
        </VStack>
      </HStack>

      <VStack gap="4">
        <Label>{t('voiceRobots.description', 'Описание')}</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('voiceRobots.descriptionPlaceholder', 'Робот для маршрутизации звонков...')}
          rows={2}
        />
      </VStack>

      {/* TTS / STT Engines + Language — responsive 3-column row */}
      <Flex className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <VStack gap="4">
          <HStack align="center" gap="4">
            <Label>{t('voiceRobots.ttsEngine', 'TTS Engine (Синтез)')}</Label>
            <InfoTooltip text={t('voiceRobots.ttsEngineHint', 'Движок синтеза речи для озвучивания ответов робота.')} />
          </HStack>
          <Select value={ttsId} onChange={(e) => setTtsId(Number(e.target.value))}>
            <option value={0}>{t('common.notSelected', '-- Не выбрано --')}</option>
            {ttsEngines?.map(e => <option key={e.uid} value={e.uid}>{e.name}</option>)}
          </Select>
        </VStack>

        <VStack gap="4">
          <HStack align="center" gap="4">
            <Label>{t('voiceRobots.sttEngine', 'STT Engine (Распознавание)')}</Label>
            <InfoTooltip text={t('voiceRobots.sttEngineHint', 'Движок распознавания речи для понимания ответов клиента.')} />
          </HStack>
          <Select value={sttId} onChange={(e) => setSttId(Number(e.target.value))}>
            <option value={0}>{t('common.notSelected', '-- Не выбрано --')}</option>
            {sttEngines?.map(e => <option key={e.uid} value={e.uid}>{e.name}</option>)}
          </Select>
        </VStack>

        <VStack gap="4">
          <HStack align="center" gap="4">
            <Label>{t('voiceRobots.languageField', 'Язык распознавания')}</Label>
            <InfoTooltip text={t('voiceRobots.languageHint', 'Основной язык речи клиентов для STT распознавания.')} />
          </HStack>
          <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="ru-RU">Русский (ru-RU)</option>
            <option value="en-US">English (en-US)</option>
            <option value="kk-KZ">Қазақша (kk-KZ)</option>
          </Select>
        </VStack>
      </Flex>

      {/* Greeting */}
      <VStack gap="4">
        <HStack align="center" gap="4">
          <Label>{t('voiceRobots.greetingText', 'Текст приветствия')}</Label>
          <InfoTooltip text={t('voiceRobots.greetingHint', 'Робот произнесёт этот текст сразу после ответа на звонок.')} />
        </HStack>
        <Textarea
          value={greetingText}
          onChange={(e) => setGreetingText(e.target.value)}
          placeholder={t('voiceRobots.greetingTextPlaceholder', 'Здравствуйте! Чем могу помочь?')}
          rows={2}
        />
      </VStack>

      {/* Initial Group */}
      {robotId && keywordGroups.length > 0 && (
        <VStack gap="4">
          <HStack align="center" gap="4">
            <Label>{t('voiceRobots.initialGroup', 'Стартовая группа сценариев')}</Label>
            <InfoTooltip text={t('voiceRobots.initialGroupHint', 'Группа ключевых слов, с которой робот начнёт диалог после приветствия. Остальные группы доступны через действие «Переключить сценарий».')} />
          </HStack>
          <Select
            value={initialGroupId ?? ''}
            onChange={(e) => setInitialGroupId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t('voiceRobots.autoDetectGroup', '-- Автоматически (первая группа) --')}</option>
            {keywordGroups
              .filter((g: any) => !g.is_global)
              .map((g: any) => (
                <option key={g.uid} value={g.uid}>{g.name} (ID: {g.uid})</option>
              ))}
          </Select>
        </VStack>
      )}

      {/* ═══ Error Handling Section ═══ */}
      <VStack gap="12" className="p-4 border border-border rounded-lg bg-card">
        <HStack gap="8" align="center">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <Text className="text-sm font-semibold text-foreground">
            {t('voiceRobots.errorHandling', 'Обработка ошибок')}
          </Text>
        </HStack>

        <Flex className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <VStack gap="4">
            <HStack align="center" gap="4">
              <Label>{t('voiceRobots.maxSteps', 'Максимум шагов диалога')}</Label>
              <InfoTooltip text={t('voiceRobots.maxStepsHint', 'Защита от зацикливания звонка. При достижении N шагов звонок завершится по сценарию ниже.')} />
            </HStack>
            <Input type="number" min={1} max={50} value={maxSteps}
              onChange={e => setMaxSteps(Number(e.target.value))} />
          </VStack>

          <VStack gap="4">
            <HStack align="center" gap="4">
              <Label>{t('voiceRobots.silenceTimeout', 'Таймаут молчания (сек)')}</Label>
              <InfoTooltip text={t('voiceRobots.inactivityTimeoutHint', 'Если клиент молчит, через это время робот повторит вопрос.')} />
            </HStack>
            <Input type="number" min={5} max={120} value={silenceTimeoutSeconds}
              onChange={e => setSilenceTimeoutSeconds(Number(e.target.value))} />
          </VStack>

          <VStack gap="4">
            <HStack align="center" gap="4">
              <Label>{t('voiceRobots.maxInactivityRepeats', 'Макс. повторов без ответа')}</Label>
              <InfoTooltip text={t('voiceRobots.maxInactivityRepeatsHint', 'Сколько раз робот повторит вопрос, если клиент молчит или ответ не распознан. После исчерпания лимита сработает действие ниже.')} />
            </HStack>
            <Input type="number" min={0} max={10} value={maxInactivityRepeats}
              onChange={e => setMaxInactivityRepeats(Number(e.target.value))} />
          </VStack>
        </Flex>

        {/* Fallback Action (collapsible) */}
        <VStack gap="4">
          <Button
            variant="ghost"
            onClick={() => setShowFallback(!showFallback)}
            className="justify-start px-0 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {showFallback ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <Text variant="small" className="ml-1">
              {t('voiceRobots.fallbackAction', 'Если робот НЕ распознал фразу')}
            </Text>
          </Button>
          {showFallback && (
            <VStack gap="4" className="pl-4 border-l-2 border-border/30">
              <Text variant="xs" className="text-muted-foreground">
                {t('voiceRobots.fallbackActionHint', 'Действие при отсутствии совпадений с ключевыми словами.')}
              </Text>
              <VoiceRobotActionEditor action={fallbackBotAction} onChange={setFallbackBotAction} compact />
            </VStack>
          )}
        </VStack>

        {/* Max Retries Action (collapsible) */}
        <VStack gap="4">
          <Button
            variant="ghost"
            onClick={() => setShowMaxRetries(!showMaxRetries)}
            className="justify-start px-0 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {showMaxRetries ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <Text variant="small" className="ml-1">
              {t('voiceRobots.maxRetriesAction', 'Если исчерпан лимит шагов')}
            </Text>
          </Button>
          {showMaxRetries && (
            <VStack gap="4" className="pl-4 border-l-2 border-border/30">
              <Text variant="xs" className="text-muted-foreground">
                {t('voiceRobots.maxRetriesActionHint', 'Действие при достижении максимума шагов диалога.')}
              </Text>
              <VoiceRobotActionEditor action={maxRetriesBotAction} onChange={setMaxRetriesBotAction} compact />
            </VStack>
          )}
        </VStack>
      </VStack>
    </VStack>
  );
});

VoiceRobotGeneralTab.displayName = 'VoiceRobotGeneralTab';
