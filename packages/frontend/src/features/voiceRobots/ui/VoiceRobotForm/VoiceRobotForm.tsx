import { memo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Text, Card, CardContent, CardFooter } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Bot, Save, ArrowLeft, Database } from 'lucide-react';
import { IVoiceRobot, IVoiceRobotVadConfig, IVoiceRobotBotAction } from '@/entities/voiceRobot';
import { useGetSttEnginesQuery } from '@/shared/api/endpoints/sttEnginesApi';
import { useGetTtsEnginesQuery } from '@/shared/api/endpoints/ttsEnginesApi';
import { useCreateVoiceRobotMutation, useUpdateVoiceRobotMutation } from '@/shared/api/endpoints/voiceRobotsApi';

import { VoiceRobotGeneralTab } from './VoiceRobotGeneralTab';
import { VoiceRobotDialogueTab } from './VoiceRobotKeywordsTab';
import { VoiceRobotSettingsTab } from './VoiceRobotSettingsTab';
import { TestMatchPanel } from '../TestMatchPanel/TestMatchPanel';
import { DataListEditor } from '../DataListEditor';

/** 5 tabs: Основные / Диалог / Справочники / Настройки / Тест */
const TABS = ['general', 'dialogue', 'data_lists', 'settings', 'test'] as const;

const DEFAULT_FALLBACK_ACTION: IVoiceRobotBotAction = {
  response: { type: 'tts', value: '' },
  nextState: { type: 'listen' },
};

export interface VoiceRobotFormProps {
  initialRobot?: IVoiceRobot | null;
}

export const VoiceRobotForm = memo(({ initialRobot }: VoiceRobotFormProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [createRobot, { isLoading: isCreating }] = useCreateVoiceRobotMutation();
  const [updateRobot, { isLoading: isUpdating }] = useUpdateVoiceRobotMutation();

  const { data: sttEngines } = useGetSttEnginesQuery();
  const { data: ttsEngines } = useGetTtsEnginesQuery();

  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('general');

  // ─── Form State ────────────────────────────────────────
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [description, setDescription] = useState('');

  const [sttId, setSttId] = useState<number>(0);
  const [ttsId, setTtsId] = useState<number>(0);
  const [language, setLanguage] = useState('ru-RU');

  // VAD
  const [vadConfig, setVadConfig] = useState<IVoiceRobotVadConfig>({
    silence_timeout_ms: 2000,
    max_duration_seconds: 15,
    barge_in: true,
    min_speech_duration_ms: 300,
  });

  // Flow FSM
  const [maxSteps, setMaxSteps] = useState(10);
  const [greetingText, setGreetingText] = useState('');
  const [initialGroupId, setInitialGroupId] = useState<number | null>(null);
  const [silenceTimeoutSeconds, setSilenceTimeoutSeconds] = useState(15);
  const [maxInactivityRepeats, setMaxInactivityRepeats] = useState(3);

  // TTS Mode & Cache
  const [ttsMode, setTtsMode] = useState<'streaming' | 'batch'>('batch');
  const [ttsCacheMaxAgeDays, setTtsCacheMaxAgeDays] = useState(0);

  // STT Mode
  const [sttMode, setSttMode] = useState<'hybrid' | 'full_stream'>('hybrid');
  const [externalHost, setExternalHost] = useState('');

  // Fallback / Max Retries actions
  const [fallbackBotAction, setFallbackBotAction] = useState<IVoiceRobotBotAction>({ ...DEFAULT_FALLBACK_ACTION });
  const [maxRetriesBotAction, setMaxRetriesBotAction] = useState<IVoiceRobotBotAction>({ ...DEFAULT_FALLBACK_ACTION });

  // ─── Populate from initialRobot ──────────────────────
  useEffect(() => {
    if (initialRobot) {
      setName(initialRobot.name);
      setActive(initialRobot.active);
      setDescription(initialRobot.description || '');
      setSttId(initialRobot.stt_engine_id || 0);
      setTtsId(initialRobot.tts_engine_id || 0);
      setLanguage(initialRobot.language || 'ru-RU');
      setVadConfig(initialRobot.vad_config || { silence_timeout_ms: 2000, max_duration_seconds: 15, barge_in: true, min_speech_duration_ms: 300 });
      setMaxSteps(initialRobot.max_conversation_steps || 10);
      setGreetingText(initialRobot.greeting_tts_text || '');
      setInitialGroupId(initialRobot.initial_group_id ?? null);
      setSilenceTimeoutSeconds((initialRobot as any).silence_timeout_seconds ?? 15);
      setMaxInactivityRepeats((initialRobot as any).max_inactivity_repeats ?? 3);
      setTtsMode(initialRobot.tts_mode || 'batch');
      setTtsCacheMaxAgeDays(initialRobot.tts_cache_max_age_days ?? 0);
      setSttMode(initialRobot.stt_mode || 'hybrid');
      setExternalHost(initialRobot.external_host || '');
      setFallbackBotAction((initialRobot as any).fallback_bot_action || { ...DEFAULT_FALLBACK_ACTION });
      setMaxRetriesBotAction((initialRobot as any).max_retries_bot_action || { ...DEFAULT_FALLBACK_ACTION });
    }
  }, [initialRobot]);

  const handleCancel = useCallback(() => {
    navigate('/voice-robots');
  }, [navigate]);

  /** Strip fields irrelevant to the selected nextState type */
  const sanitizeBotAction = (a: IVoiceRobotBotAction): IVoiceRobotBotAction => {
    const clean = { ...a };
    const type = clean.nextState?.type;
    if (type !== 'webhook') {
      delete clean.webhookAuth;
      delete clean.webhookResponseTemplate;
    }
    if (type !== 'search_data_list') {
      delete clean.dataListSearch;
    }
    if (type === 'listen' || type === 'hangup') {
      clean.nextState = { ...clean.nextState, target: '' };
    }
    return clean;
  };

  const handleSave = async () => {
    const data = {
      name, active, description: description || null,
      stt_engine_id: sttId || null,
      tts_engine_id: ttsId || null,
      language,
      vad_config: vadConfig,
      max_conversation_steps: maxSteps,
      greeting_tts_text: greetingText || null,
      initial_group_id: initialGroupId,
      tts_mode: ttsMode,
      tts_cache_max_age_days: ttsCacheMaxAgeDays,
      stt_mode: sttMode,
      external_host: externalHost || null,
      silence_timeout_seconds: silenceTimeoutSeconds,
      max_inactivity_repeats: maxInactivityRepeats,
      fallback_bot_action: sanitizeBotAction(fallbackBotAction),
      max_retries_bot_action: sanitizeBotAction(maxRetriesBotAction),
    };

    try {
      if (initialRobot) {
        await updateRobot({ uid: initialRobot.uid, data }).unwrap();
      } else {
        const result = await createRobot(data).unwrap();
        // Option 1: navigate to edit if you want to stay
        // navigate(`/voice-robots/${result.uid}`);
      }
      navigate('/voice-robots');
    } catch (err) {
      console.error('Failed to save voice robot:', err);
    }
  };

  return (
    <Card className="flex flex-col flex-1 h-full shadow-md rounded-xl overflow-hidden border border-border/50 bg-background/50 backdrop-blur-xl">
      <CardContent className="flex flex-col h-full flex-1 p-0 overflow-hidden">
        {/* Tabs Bar */}
        <VStack className="border-b border-border/50 shrink-0 bg-muted/10 px-6 pt-4" max>
          <HStack gap="8" className="-mb-[1px] flex overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {TABS.map((tab) => (
              <Button
                key={tab}
                variant="ghost"
                onClick={() => setActiveTab(tab)}
                className={`relative py-3 px-1 rounded-none text-sm font-medium transition-colors whitespace-nowrap shrink-0 outline-none ${
                    activeTab === tab ? 'text-primary bg-transparent hover:bg-transparent hover:text-primary' : 'text-muted-foreground bg-transparent hover:text-foreground hover:bg-transparent'
                }`}
              >
                {t(`voiceRobots.tabs.${tab}`, tab)}
                {activeTab === tab && (
                  <VStack className="absolute left-0 right-0 bottom-0 h-[2px] bg-primary rounded-t-[1px]">{''}</VStack>
                )}
              </Button>
            ))}
          </HStack>
        </VStack>

        {/* Tab Content */}
        <VStack className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === 'general' && (
            <VoiceRobotGeneralTab
              name={name} setName={setName}
              active={active} setActive={setActive}
              description={description} setDescription={setDescription}
              ttsId={ttsId} setTtsId={setTtsId}
              sttId={sttId} setSttId={setSttId}
              language={language} setLanguage={setLanguage}
              greetingText={greetingText} setGreetingText={setGreetingText}
              initialGroupId={initialGroupId} setInitialGroupId={setInitialGroupId}
              robotId={initialRobot?.uid ?? null}
              maxSteps={maxSteps} setMaxSteps={setMaxSteps}
              silenceTimeoutSeconds={silenceTimeoutSeconds} setSilenceTimeoutSeconds={setSilenceTimeoutSeconds}
              maxInactivityRepeats={maxInactivityRepeats} setMaxInactivityRepeats={setMaxInactivityRepeats}
              fallbackBotAction={fallbackBotAction} setFallbackBotAction={setFallbackBotAction}
              maxRetriesBotAction={maxRetriesBotAction} setMaxRetriesBotAction={setMaxRetriesBotAction}
              ttsEngines={ttsEngines} sttEngines={sttEngines}
            />
          )}

          {activeTab === 'dialogue' && (
            <VoiceRobotDialogueTab selectedRobot={initialRobot} />
          )}

          {activeTab === 'settings' && (
            <VoiceRobotSettingsTab
              vadConfig={vadConfig} setVadConfig={setVadConfig}
              ttsMode={ttsMode} setTtsMode={setTtsMode}
              ttsCacheMaxAgeDays={ttsCacheMaxAgeDays} setTtsCacheMaxAgeDays={setTtsCacheMaxAgeDays}
              sttMode={sttMode} setSttMode={setSttMode}
              externalHost={externalHost} setExternalHost={setExternalHost}
            />
          )}

          {activeTab === 'data_lists' && (
            initialRobot ? (
              <DataListEditor robotId={initialRobot.uid} />
            ) : (
              <VStack align="center" justify="center" gap="8" className="py-16 border border-dashed border-border/50 rounded-lg bg-background/30 mt-4">
                <Database className="w-12 h-12 text-muted-foreground/50" />
                <Text variant="h3" className="text-muted-foreground">{t('voiceRobots.dataLists.title', 'Справочники данных')}</Text>
                <Text variant="muted" className="text-center max-w-md">
                  {t('voiceRobots.saveRobotFirst', 'Сначала сохраните базовые настройки робота.')}
                </Text>
              </VStack>
            )
          )}

          {activeTab === 'test' && (
            initialRobot ? (
              <TestMatchPanel robotId={initialRobot.uid} />
            ) : (
                <VStack align="center" justify="center" gap="8" className="py-16 border border-dashed border-border/50 rounded-lg bg-background/30 mt-4">
                  <Bot className="w-12 h-12 text-muted-foreground/50" />
                  <Text variant="h3" className="text-muted-foreground">{t('voiceRobots.testPanel.title', 'Тест распознавания')}</Text>
                  <Text variant="muted" className="text-center max-w-md">
                    {t('voiceRobots.saveRobotFirst', 'Сначала сохраните базовые настройки робота.')}
                  </Text>
                </VStack>
            )
          )}
        </VStack>
      </CardContent>

      <CardFooter className="shrink-0 border-t border-border/50 bg-muted/10 p-4 flex justify-between">
         <Button variant="outline" onClick={handleCancel}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.cancel', 'Отмена')}
         </Button>
         <Button onClick={handleSave} disabled={isCreating || isUpdating || !name.trim()} className="shadow-lg shadow-primary/20">
            <Save className="w-4 h-4 mr-2" />
            {t('common.save', 'Сохранить')}
         </Button>
      </CardFooter>
    </Card>
  );
});

VoiceRobotForm.displayName = 'VoiceRobotForm';
