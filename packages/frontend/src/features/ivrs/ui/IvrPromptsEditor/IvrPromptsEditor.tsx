import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ChevronUp, ChevronDown, Trash2, Plus, Music, Volume2, Mic } from 'lucide-react';
import type { IIvrPhrase, IIvrPhraseTtsSettings } from '@krasterisk/shared';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import { useGetTtsEnginesQuery } from '@/shared/api/endpoints/ttsEnginesApi';
import { usePreviewIvrTtsMutation } from '@/shared/api/endpoints/ivrsApi';
import { Button, Select, Text, Textarea } from '@/shared/ui';
import { VStack, Flex, HStack } from '@/shared/ui/Stack';
import { IvrPhraseTtsFields } from '../IvrPhraseTtsFields/IvrPhraseTtsFields';
import cls from './IvrPromptsEditor.module.scss';

type AddMode = 'audio' | 'tts';

interface IvrPromptsEditorProps {
  value: IIvrPhrase[];
  onChange: (prompts: IIvrPhrase[]) => void;
}

export function IvrPromptsEditor({ value, onChange }: IvrPromptsEditorProps) {
  const { t } = useTranslation();
  const { data: allPrompts = [] } = useGetPromptsQuery();
  const { data: engines = [] } = useGetTtsEnginesQuery();
  const [previewTts, { isLoading: isPreviewLoading }] = usePreviewIvrTtsMutation();

  const [addMode, setAddMode] = useState<AddMode>('audio');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [ttsText, setTtsText] = useState('');
  const [ttsEngineUid, setTtsEngineUid] = useState('');
  const [ttsSettings, setTtsSettings] = useState<IIvrPhraseTtsSettings>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedEngine = engines.find((e) => String(e.uid) === ttsEngineUid) ?? null;

  const getPromptLabel = (filename: string): string => {
    const found = allPrompts.find((p) => p.filename === filename);
    return found?.comment || filename;
  };

  const getEngineName = (uid: number): string => {
    return engines.find((e) => e.uid === uid)?.name || `#${uid}`;
  };

  const summarizeTts = (phrase: Extract<IIvrPhrase, { kind: 'tts' }>): string => {
    const parts: string[] = [];
    if (phrase.settings?.voice) parts.push(phrase.settings.voice);
    if (phrase.settings?.speed) parts.push(`${phrase.settings.speed}`);
    if (phrase.settings?.speaking_rate) parts.push(`${phrase.settings.speaking_rate}`);
    return parts.length ? parts.join(', ') : t('ivrs.prompts.engineDefaults', 'настройки движка');
  };

  const handleAddAudio = () => {
    if (!selectedPrompt) return;
    onChange([...value, { kind: 'audio', filename: selectedPrompt }]);
    setSelectedPrompt('');
  };

  const handleAddTts = () => {
    const engineUid = parseInt(ttsEngineUid, 10);
    if (!ttsText.trim() || !engineUid) {
      toast.warning(t('ivrs.prompts.ttsRequired', 'Укажите текст и TTS-движок'));
      return;
    }
    const settings = Object.keys(ttsSettings).length ? ttsSettings : undefined;
    onChange([
      ...value,
      { kind: 'tts', text: ttsText.trim(), engine_uid: engineUid, settings },
    ]);
    setTtsText('');
    setTtsEngineUid('');
    setTtsSettings({});
  };

  const handlePreview = async () => {
    const engineUid = parseInt(ttsEngineUid, 10);
    if (!ttsText.trim() || !engineUid) {
      toast.warning(t('ivrs.prompts.ttsRequired', 'Укажите текст и TTS-движок'));
      return;
    }
    try {
      const blob = await previewTts({
        text: ttsText.trim(),
        engine_uid: engineUid,
        settings: Object.keys(ttsSettings).length ? ttsSettings : undefined,
      }).unwrap();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
      }
    } catch (err: any) {
      toast.error(
        err?.data?.message || t('ivrs.prompts.previewError', 'Не удалось синтезировать фразу'),
      );
    }
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...value];
    [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
    onChange(copy);
  };

  const handleMoveDown = (index: number) => {
    if (index >= value.length - 1) return;
    const copy = [...value];
    [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
    onChange(copy);
  };

  const usedAudioFilenames = new Set(
    value.filter((p): p is Extract<IIvrPhrase, { kind: 'audio' }> => p.kind === 'audio').map((p) => p.filename),
  );
  const availablePrompts = allPrompts.filter((p) => !usedAudioFilenames.has(p.filename));

  return (
    <div className={cls.sectionPanel}>
      <audio ref={audioRef} className={cls.hiddenAudio} />
      <VStack gap="12" max className={cls.promptsEditor}>
        {value.length === 0 && (
          <VStack align="center" gap="8" className={cls.emptyState}>
            <Music size={32} className={cls.emptyIcon} />
            <Text variant="small">
              {t(
                'ivrs.prompts.emptyMixed',
                'Нет фраз. Добавьте аудиозапись или TTS-текст для воспроизведения в IVR.',
              )}
            </Text>
          </VStack>
        )}

        {value.map((phrase, index) => (
          <Flex key={`${phrase.kind}-${index}`} align="center" className={cls.promptItem}>
            <Text as="span" className={cls.promptIndex}>
              {index + 1}
            </Text>
            <span
              className={
                phrase.kind === 'tts' ? cls.badgeTts : cls.badgeAudio
              }
            >
              {phrase.kind === 'tts'
                ? t('ivrs.prompts.badgeTts', 'TTS')
                : t('ivrs.prompts.badgeAudio', 'Аудио')}
            </span>
            <Text as="span" className={cls.promptName}>
              {phrase.kind === 'audio'
                ? getPromptLabel(phrase.filename)
                : `${phrase.text.slice(0, 80)}${phrase.text.length > 80 ? '…' : ''} · ${getEngineName(phrase.engine_uid)} · ${summarizeTts(phrase)}`}
            </Text>
            <HStack gap="0" className={cls.trackActions}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                title={t('common.moveUp', 'Вверх')}
              >
                <ChevronUp size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleMoveDown(index)}
                disabled={index >= value.length - 1}
                title={t('common.moveDown', 'Вниз')}
              >
                <ChevronDown size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cls.deleteBtn}
                onClick={() => handleRemove(index)}
                title={t('common.delete', 'Удалить')}
              >
                <Trash2 size={14} />
              </Button>
            </HStack>
          </Flex>
        ))}

        <div className={cls.addSection}>
          <HStack gap="8" className={cls.modeToggle}>
            <Button
              type="button"
              variant={addMode === 'audio' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAddMode('audio')}
            >
              <Volume2 size={14} />
              {t('ivrs.prompts.modeAudio', 'Запись')}
            </Button>
            <Button
              type="button"
              variant={addMode === 'tts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAddMode('tts')}
            >
              <Mic size={14} />
              {t('ivrs.prompts.modeTts', 'TTS')}
            </Button>
          </HStack>

          {addMode === 'audio' ? (
            <Flex align="center" className={cls.addRow}>
              <Select
                className={cls.promptSelect}
                value={selectedPrompt}
                onChange={(e) => setSelectedPrompt(e.target.value)}
              >
                <option value="">{t('ivrs.prompts.selectPrompt', 'Выберите запись')}</option>
                {availablePrompts.map((p) => (
                  <option key={p.uid} value={p.filename}>
                    {p.comment || p.filename}
                  </option>
                ))}
              </Select>
              <Button type="button" onClick={handleAddAudio} disabled={!selectedPrompt} className={cls.addBtn}>
                <Plus size={16} />
                {t('ivrs.prompts.add', 'Добавить')}
              </Button>
            </Flex>
          ) : (
            <VStack gap="12" className={cls.ttsForm}>
              <Textarea
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder={t('ivrs.prompts.textPlaceholder', 'Текст фразы для синтеза')}
                rows={3}
              />
              <VStack gap="4">
                <Text variant="small">{t('ivrs.prompts.engine', 'TTS-движок')}</Text>
                <Select value={ttsEngineUid} onChange={(e) => setTtsEngineUid(e.target.value)}>
                  <option value="">{t('ivrs.prompts.selectEngine', 'Выберите движок')}</option>
                  {engines.map((eng) => (
                    <option key={eng.uid} value={String(eng.uid)}>
                      {eng.name} ({eng.type})
                    </option>
                  ))}
                </Select>
              </VStack>
              <IvrPhraseTtsFields
                engine={selectedEngine}
                settings={ttsSettings}
                onChange={setTtsSettings}
              />
              <HStack gap="8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={isPreviewLoading || !ttsText.trim() || !ttsEngineUid}
                >
                  {t('ivrs.prompts.preview', 'Прослушать')}
                </Button>
                <Button type="button" onClick={handleAddTts} disabled={!ttsText.trim() || !ttsEngineUid}>
                  <Plus size={16} />
                  {t('ivrs.prompts.addTts', 'Добавить TTS')}
                </Button>
              </HStack>
            </VStack>
          )}
        </div>
      </VStack>
    </div>
  );
}
