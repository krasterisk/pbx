import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MicVocal, Volume2, Ear, Network } from 'lucide-react';
import { VStack, HStack, Flex, Input, Label, Text, Select, Checkbox } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { IVoiceRobotVadConfig } from '@/entities/voiceRobot';

/** Cache lifetime options: 0=unlimited, then common day values */
const CACHE_AGE_OPTIONS = [0, 7, 14, 30, 60, 90] as const;

interface VoiceRobotSettingsTabProps {
  // VAD
  vadConfig: IVoiceRobotVadConfig;
  setVadConfig: (config: IVoiceRobotVadConfig) => void;
  // TTS
  ttsMode: 'streaming' | 'batch';
  setTtsMode: (v: 'streaming' | 'batch') => void;
  ttsCacheMaxAgeDays: number;
  setTtsCacheMaxAgeDays: (v: number) => void;
  // STT
  sttMode: 'hybrid' | 'full_stream';
  setSttMode: (v: 'hybrid' | 'full_stream') => void;
  // Network
  externalHost: string;
  setExternalHost: (v: string) => void;
}

/**
 * VoiceRobotSettingsTab — unified settings tab merging VAD + TTS/STT configuration.
 *
 * Replaces separate VoiceRobotVadTab and VoiceRobotAdvancedTab.
 * Three sections: TTS Engine, STT Engine, Voice Activity Detection.
 *
 * FSD layer: features/voiceRobots/ui
 */
export const VoiceRobotSettingsTab = memo(({
  vadConfig, setVadConfig,
  ttsMode, setTtsMode,
  ttsCacheMaxAgeDays, setTtsCacheMaxAgeDays,
  sttMode, setSttMode,
  externalHost, setExternalHost,
}: VoiceRobotSettingsTabProps) => {
  const { t } = useTranslation();

  return (
    <VStack gap="24">
      {/* ─── TTS Engine Settings ─── */}
      <VStack gap="12" className="p-4 border border-border rounded-lg bg-card">
        <HStack gap="8" align="center">
          <Volume2 className="w-5 h-5 text-primary" />
          <Text className="text-sm font-semibold text-foreground">
            {t('voiceRobots.tts.title', 'Голосовой движок (TTS)')}
          </Text>
        </HStack>

        {/* Mode selector */}
        <VStack gap="4">
          <HStack align="center" gap="4">
            <Label>{t('voiceRobots.tts.mode', 'Режим синтеза')}</Label>
            <InfoTooltip text={t('voiceRobots.tts.modeTooltip', 'Batch — экономичнее, фразы кэшируются. Streaming — минимальная задержка, но дороже.')} />
          </HStack>
          <Select
            value={ttsMode}
            onChange={(e) => setTtsMode(e.target.value as 'streaming' | 'batch')}
          >
            <option value="batch">{t('voiceRobots.tts.modeBatch', 'Batch (с кэшем)')}</option>
            <option value="streaming">{t('voiceRobots.tts.modeStreaming', 'Потоковый (Streaming)')}</option>
          </Select>
          <Text variant="xs" className="text-muted-foreground max-w-lg">
            {ttsMode === 'batch'
              ? t('voiceRobots.tts.batchHint', 'Фраза синтезируется один раз и сохраняется на диск. При повторном озвучивании файл проигрывается из кэша без обращения к внешнему API. Рекомендуется для статических фраз.')
              : t('voiceRobots.tts.streamingHint', 'Аудио передаётся чанками в реальном времени с минимальной задержкой (~100-200ms). Рекомендуется для динамических фраз с интерполяцией.')
            }
          </Text>
        </VStack>

        {/* Cache lifetime — only visible in batch mode */}
        {ttsMode === 'batch' && (
          <VStack gap="4">
            <HStack align="center" gap="4">
              <Label>{t('voiceRobots.tts.cacheMaxAge', 'Срок хранения кэша')}</Label>
              <InfoTooltip text={t('voiceRobots.tts.cacheMaxAgeHint', 'Кэшированные аудиофайлы старше указанного срока удаляются автоматически. «Без ограничений» — файлы хранятся бессрочно.')} />
            </HStack>
            <Select
              value={String(ttsCacheMaxAgeDays)}
              onChange={(e) => setTtsCacheMaxAgeDays(Number(e.target.value))}
            >
              {CACHE_AGE_OPTIONS.map((days) => (
                <option key={days} value={String(days)}>
                  {days === 0
                    ? t('voiceRobots.tts.cacheUnlimited', 'Без ограничений')
                    : t('voiceRobots.tts.cacheDays', '{{count}} дней', { count: days })
                  }
                </option>
              ))}
            </Select>
          </VStack>
        )}
      </VStack>

      {/* ─── STT Engine Settings ─── */}
      <VStack gap="12" className="p-4 border border-border rounded-lg bg-card">
        <HStack gap="8" align="center">
          <Ear className="w-5 h-5 text-primary" />
          <Text className="text-sm font-semibold text-foreground">
            {t('voiceRobots.stt.title', 'Распознавание речи (STT)')}
          </Text>
        </HStack>

        <VStack gap="4">
          <HStack align="center" gap="4">
            <Label>{t('voiceRobots.stt.mode', 'Режим распознавания')}</Label>
            <InfoTooltip text={t('voiceRobots.stt.modeTooltip', 'Hybrid — экономит деньги (stream только во время речи). Full-Stream — нулевая задержка, но постоянное подключение.')} />
          </HStack>
          <Select
            value={sttMode}
            onChange={(e) => setSttMode(e.target.value as 'hybrid' | 'full_stream')}
          >
            <option value="hybrid">{t('voiceRobots.stt.modeHybrid', 'Hybrid (VAD + Stream)')}</option>
            <option value="full_stream">{t('voiceRobots.stt.modeFullStream', 'Full-Stream (без VAD)')}</option>
          </Select>
          <Text variant="xs" className="text-muted-foreground max-w-lg">
            {sttMode === 'hybrid'
              ? t('voiceRobots.stt.hybridHint', 'Silero VAD детектит начало речи → открывает gRPC stream → пишет PCM16. Яндекс шлёт EOU + final text → keyword match. VAD экономит деньги (stream только во время речи). Рекомендуется.')
              : t('voiceRobots.stt.fullStreamHint', 'gRPC stream открыт всё время сессии. VAD не используется. Яндекс детектит речь/тишину сам. Дороже, но нулевая локальная задержка.')
            }
          </Text>
        </VStack>
      </VStack>

      {/* ─── VAD Settings ─── */}
      <VStack gap="12" className="p-4 border border-border rounded-lg bg-card">
        <HStack gap="8" align="center">
          <MicVocal className="w-5 h-5 text-primary" />
          <Text className="text-sm font-semibold text-foreground">
            {t('voiceRobots.vad.title', 'Детекция голоса (VAD)')}
          </Text>
        </HStack>

        <Text variant="xs" className="text-muted-foreground">
          {t('voiceRobots.vadDescription', 'Voice Activity Detection (VAD) работает локально через Silero v6. Эти настройки определяют, насколько чувствительным будет робот при слушании абонента.')}
        </Text>

        <Flex className="grid grid-cols-2 gap-6">
          <VStack gap="4">
            <HStack align="center" gap="4">
              <Label>{t('voiceRobots.silenceTimeout', 'Таймаут тишины (ms)')}</Label>
              <InfoTooltip text={t('voiceRobots.silenceTimeoutHint', 'Завершает запись после N миллисекунд тишины')} />
            </HStack>
            <Input type="number" min={500} max={10000} step={100} value={vadConfig.silence_timeout_ms}
              onChange={e => setVadConfig({ ...vadConfig, silence_timeout_ms: Number(e.target.value) })} />
          </VStack>

          <VStack gap="4">
            <HStack align="center" gap="4">
              <Label>{t('voiceRobots.minSpeech', 'Мин. длительность речи (ms)')}</Label>
              <InfoTooltip text={t('voiceRobots.minSpeechHint', 'Игнорировать звуки короче N (защита от вздохов/шума)')} />
            </HStack>
            <Input type="number" min={100} max={3000} step={100} value={vadConfig.min_speech_duration_ms}
              onChange={e => setVadConfig({ ...vadConfig, min_speech_duration_ms: Number(e.target.value) })} />
          </VStack>

          <VStack gap="4">
            <HStack align="center" gap="4">
              <Label>{t('voiceRobots.maxDuration', 'Макс. длительность записи (сек)')}</Label>
              <InfoTooltip text={t('voiceRobots.maxDurationHint', 'Принудительно обрывать абонента, если он говорит без остановки')} />
            </HStack>
            <Input type="number" min={5} max={120} step={1} value={vadConfig.max_duration_seconds}
              onChange={e => setVadConfig({ ...vadConfig, max_duration_seconds: Number(e.target.value) })} />
          </VStack>
        </Flex>

        <HStack gap="12" align="center" className="mt-2 p-3 border border-border rounded-lg bg-background w-full">
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={vadConfig.barge_in}
              onChange={(e) => setVadConfig({ ...vadConfig, barge_in: e.target.checked })} />
            <Text variant="small">{t('voiceRobots.bargeIn', 'Barge-In (Прерывание робота)')}</Text>
          </Label>
          <InfoTooltip text={t('voiceRobots.bargeInHint', 'Позволяет абоненту перебивать синтезированную речь робота.')} />
        </HStack>
      </VStack>

      {/* ─── Network Settings ─── */}
      <VStack gap="12" className="p-4 border border-border rounded-lg bg-card">
        <HStack gap="8" align="center">
          <Network className="w-5 h-5 text-primary" />
          <Text className="text-sm font-semibold text-foreground">
            {t('voiceRobots.network.title', 'Сетевые настройки (RTP)')}
          </Text>
        </HStack>

        <VStack gap="4">
          <HStack align="center" gap="4">
            <Label>{t('voiceRobots.network.externalHost', 'Внешний IP-адрес (External Host)')}</Label>
            <InfoTooltip text={t('voiceRobots.network.externalHostHint', 'Оставьте пустым для использования глобального адреса (из .env). Укажите публичный IP, если Астериск находится на удалённом сервере, чтобы он знал куда слать RTP трафик.')} />
          </HStack>
          <Input 
            type="text" 
            placeholder="127.0.0.1" 
            value={externalHost}
            onChange={e => setExternalHost(e.target.value)} 
          />
          <Text variant="xs" className="text-muted-foreground">
            {t('voiceRobots.network.externalHostDesc', 'Если бэкенд и Астериск на одном сервере, оставьте пустым.')}
          </Text>
        </VStack>
      </VStack>
    </VStack>
  );
});

VoiceRobotSettingsTab.displayName = 'VoiceRobotSettingsTab';
