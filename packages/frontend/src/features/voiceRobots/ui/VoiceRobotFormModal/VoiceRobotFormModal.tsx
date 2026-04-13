import { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Settings2, Code, MicVocal } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input, VStack, HStack, Flex, Text, Label, Select, Checkbox } from '@/shared/ui';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { voiceRobotsActions } from '../../model/slice/voiceRobotsSlice';
import { selectVoiceRobotsIsModalOpen, selectVoiceRobotsSelectedRobot } from '../../model/selectors/voiceRobotsSelectors';
import { IVoiceRobotVadConfig } from '@/entities/voiceRobot';
import { useGetSttEnginesQuery } from '@/shared/api/endpoints/sttEnginesApi';
import { useGetTtsEnginesQuery } from '@/shared/api/endpoints/ttsEnginesApi';
import { useCreateVoiceRobotMutation, useUpdateVoiceRobotMutation } from '@/shared/api/endpoints/voiceRobotsApi';

const TABS = ['general', 'vad', 'keywords', 'advanced'] as const;

export const VoiceRobotFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isModalOpen = useAppSelector(selectVoiceRobotsIsModalOpen);
  const selectedRobot = useAppSelector(selectVoiceRobotsSelectedRobot);

  const [createRobot, { isLoading: isCreating }] = useCreateVoiceRobotMutation();
  const [updateRobot, { isLoading: isUpdating }] = useUpdateVoiceRobotMutation();

  const { data: sttEngines } = useGetSttEnginesQuery();
  const { data: ttsEngines } = useGetTtsEnginesQuery();

  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('general');

  // Form State
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

  useEffect(() => {
    if (selectedRobot) {
      setName(selectedRobot.name);
      setActive(selectedRobot.active);
      setDescription(selectedRobot.description || '');
      setSttId(selectedRobot.stt_engine_id || 0);
      setTtsId(selectedRobot.tts_engine_id || 0);
      setLanguage(selectedRobot.language || 'ru-RU');
      setVadConfig(selectedRobot.vad_config || { silence_timeout_ms: 2000, max_duration_seconds: 15, barge_in: true, min_speech_duration_ms: 300 });
      setMaxSteps(selectedRobot.max_conversation_steps || 10);
      setGreetingText(selectedRobot.greeting_tts_text || '');
    } else {
      setName(''); setActive(true); setDescription('');
      setSttId(0); setTtsId(0); setLanguage('ru-RU');
      setVadConfig({ silence_timeout_ms: 2000, max_duration_seconds: 15, barge_in: true, min_speech_duration_ms: 300 });
      setMaxSteps(10); setGreetingText('');
      setActiveTab('general');
    }
  }, [selectedRobot]);

  const handleClose = () => dispatch(voiceRobotsActions.closeModal());

  const handleSave = async () => {
    const data = {
      name, active, description: description || null,
      stt_engine_id: sttId || null,
      tts_engine_id: ttsId || null,
      language,
      vad_config: vadConfig,
      max_conversation_steps: maxSteps,
      greeting_tts_text: greetingText || null,
    };

    if (selectedRobot) {
      await updateRobot({ uid: selectedRobot.uid, data }).unwrap();
    } else {
      await createRobot(data).unwrap();
    }
    handleClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-full">
        <DialogHeader>
          <DialogTitle>
            {selectedRobot ? t('voiceRobots.edit', 'Редактировать робота') : t('voiceRobots.create', 'Создание робота')}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <Flex className="bg-muted/30 p-1 rounded-lg w-fit mt-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {t(`voiceRobots.tabs.${tab}`, tab)}
            </button>
          ))}
        </Flex>

        <VStack className="py-4">
          {activeTab === 'general' && (
            <VStack gap="16">
               <HStack gap="12" align="center">
                <HStack as="label" align="center" gap="8" className="cursor-pointer">
                  <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />
                  <Text variant="small">{t('common.active', 'Активен')}</Text>
                </HStack>
              </HStack>

              <HStack gap="16">
                <VStack gap="4" className="flex-1">
                  <Label>{t('voiceRobots.nameField', 'Имя робота')}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Support Bot" />
                </VStack>
              </HStack>

              <Flex className="grid grid-cols-2 gap-4">
                <VStack gap="4">
                  <Label>TTS Engine</Label>
                  <Select value={ttsId} onChange={(e) => setTtsId(Number(e.target.value))}>
                    <option value={0}>-- Не выбрано --</option>
                    {ttsEngines?.map(e => <option key={e.uid} value={e.uid}>{e.name}</option>)}
                  </Select>
                </VStack>

                <VStack gap="4">
                  <Label>STT Engine</Label>
                  <Select value={sttId} onChange={(e) => setSttId(Number(e.target.value))}>
                    <option value={0}>-- Не выбрано --</option>
                    {sttEngines?.map(e => <option key={e.uid} value={e.uid}>{e.name}</option>)}
                  </Select>
                </VStack>
              </Flex>

              <VStack gap="4">
                <Label>{t('voiceRobots.greetingText', 'Текст приветствия')}</Label>
                <Input value={greetingText} onChange={(e) => setGreetingText(e.target.value)} placeholder="Здравствуйте! Чем могу помочь?" />
              </VStack>
            </VStack>
          )}

          {activeTab === 'vad' && (
            <VStack gap="16">
              <HStack gap="16" className="bg-muted/30 p-4 rounded-lg border border-border/50 items-start">
                <MicVocal className="w-6 h-6 text-primary mt-1" />
                <Text variant="small" className="leading-relaxed text-muted-foreground">
                  Voice Activity Detection (VAD) работает локально через Silero v6.
                  Эти настройки определяют, насколько чувствительным будет робот при слушании абонента.
                </Text>
              </HStack>

               <Flex className="grid grid-cols-2 gap-6 mt-4">
                <VStack gap="4">
                  <Label>Таймаут тишины (ms)</Label>
                  <Text variant="xs">Завершает запись после N миллисекунд тишины</Text>
                  <Input type="number" min={500} max={10000} step={100} value={vadConfig.silence_timeout_ms} 
                    onChange={e => setVadConfig({ ...vadConfig, silence_timeout_ms: Number(e.target.value) })} />
                </VStack>

                <VStack gap="4">
                  <Label>Мин. длительность речи (ms)</Label>
                  <Text variant="xs">Игнорировать звуки короче N (защита от вздохов/шума)</Text>
                  <Input type="number" min={100} max={3000} step={100} value={vadConfig.min_speech_duration_ms} 
                    onChange={e => setVadConfig({ ...vadConfig, min_speech_duration_ms: Number(e.target.value) })} />
                </VStack>

                <VStack gap="4">
                  <Label>Макс. длительность (сек)</Label>
                  <Text variant="xs">Принудительно обрывать абонента, если он говорит без остановки</Text>
                  <Input type="number" min={5} max={120} step={1} value={vadConfig.max_duration_seconds} 
                    onChange={e => setVadConfig({ ...vadConfig, max_duration_seconds: Number(e.target.value) })} />
                </VStack>
              </Flex>

               <HStack gap="12" align="center" className="mt-4 p-4 border border-border rounded-lg">
                <HStack as="label" align="center" gap="8" className="cursor-pointer">
                  <Checkbox checked={vadConfig.barge_in} 
                    onChange={(e) => setVadConfig({ ...vadConfig, barge_in: e.target.checked })} />
                  <Text variant="small">Barge-In (Прерывание робота)</Text>
                </HStack>
                <Text variant="xs" className="ml-auto">Позволяет абоненту перебивать синтезированную речь робота.</Text>
              </HStack>
            </VStack>
          )}

          {activeTab === 'keywords' && (
            <VStack gap="16">
              <VStack align="center" justify="center" gap="8" className="py-10 border border-dashed rounded-lg">
                <Text variant="h3" className="text-muted-foreground">Группы ключевых слов</Text>
                <Text variant="muted" className="mb-4">Настраиваются отдельно после сохранения робота.</Text>
                {selectedRobot ? (
                  <Button variant="outline">Настроить группы</Button>
                ) : (
                  <Text variant="xs" className="text-orange-500">Сначала сохраните базовые настройки робота.</Text>
                )}
              </VStack>
            </VStack>
          )}

          {activeTab === 'advanced' && (
            <VStack gap="16">
                <VStack gap="4">
                  <Label>Максимум шагов диалога</Label>
                  <Text variant="xs">Защита от зацикливания звонка. При достижении N шагов звонок завершится по Fallback сценарию.</Text>
                  <Input type="number" min={1} max={50} className="w-40" value={maxSteps} 
                    onChange={e => setMaxSteps(Number(e.target.value))} />
                </VStack>
            </VStack>
          )}
        </VStack>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t('common.cancel', 'Отмена')}</Button>
          <Button onClick={handleSave} disabled={isCreating || isUpdating || !name.trim()}>
            {t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

VoiceRobotFormModal.displayName = 'VoiceRobotFormModal';
