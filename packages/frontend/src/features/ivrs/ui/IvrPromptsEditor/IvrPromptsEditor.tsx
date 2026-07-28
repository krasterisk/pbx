import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Music, Volume2, Mic } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { getIvrPromptsValidationIssues, type IIvrPhrase, type IIvrPhraseTtsSettings } from '@krasterisk/shared';
import { getPhraseValidationMessage } from '../../lib/ivrPromptsValidation';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import { useGetTtsEnginesQuery } from '@/shared/api/endpoints/ttsEnginesApi';
import { usePreviewIvrTtsMutation } from '@/shared/api/endpoints/ivrsApi';
import { Button, Select, Text, Textarea } from '@/shared/ui';
import { VStack, Flex, HStack } from '@/shared/ui/Stack';
import { IvrPhraseTtsFields } from '../IvrPhraseTtsFields/IvrPhraseTtsFields';
import { SortableIvrPhraseItem } from '../SortableIvrPhraseItem/SortableIvrPhraseItem';
import cls from './IvrPromptsEditor.module.scss';

type AddMode = 'audio' | 'tts';

function newPhraseId(): string {
  return `ivr-ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface IvrPromptsEditorProps {
  value: IIvrPhrase[];
  onChange: (prompts: IIvrPhrase[]) => void;
  invalidPhraseIndexes?: number[];
}

export function IvrPromptsEditor({
  value,
  onChange,
  invalidPhraseIndexes = [],
}: IvrPromptsEditorProps) {
  const { t } = useTranslation();
  const { data: allPrompts = [] } = useGetPromptsQuery();
  const { data: engines = [] } = useGetTtsEnginesQuery();
  const [previewTts, { isLoading: isPreviewLoading }] = usePreviewIvrTtsMutation();

  const [addMode, setAddMode] = useState<AddMode>('audio');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [ttsText, setTtsText] = useState('');
  const [ttsEngineUid, setTtsEngineUid] = useState('');
  const [ttsSettings, setTtsSettings] = useState<IIvrPhraseTtsSettings>({});
  const [phraseIds, setPhraseIds] = useState<string[]>([]);
  const [playingPromptUid, setPlayingPromptUid] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const selectedEngine = engines.find((e) => String(e.uid) === ttsEngineUid) ?? null;
  const selectedPromptRecord = allPrompts.find((p) => p.filename === selectedPrompt) ?? null;

  const stopAudio = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlayingPromptUid(null);
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  useEffect(() => {
    setPhraseIds((prev) => {
      if (value.length === 0) return [];
      if (prev.length === value.length) return prev;
      return value.map((_, i) => prev[i] ?? newPhraseId());
    });
  }, [value.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const getPromptLabel = (filename: string): string => {
    const found = allPrompts.find((p) => p.filename === filename);
    return found?.comment || filename;
  };

  const updatePhrase = useCallback(
    (index: number, phrase: IIvrPhrase) => {
      const copy = [...value];
      copy[index] = phrase;
      onChange(copy);
    },
    [value, onChange],
  );

  const handleAddAudio = () => {
    if (!selectedPrompt) return;
    onChange([...value, { kind: 'audio', filename: selectedPrompt }]);
    setPhraseIds((ids) => [...ids, newPhraseId()]);
    setSelectedPrompt('');
  };

  const engineOptions = engines.map((e) => ({
    uid: e.uid,
    type: e.type,
    settings: e.settings,
  }));

  const handleAddTts = () => {
    const engineUid = parseInt(ttsEngineUid, 10);
    const settings = Object.keys(ttsSettings).length ? ttsSettings : undefined;
    const draft: IIvrPhrase = {
      kind: 'tts',
      text: ttsText.trim(),
      engine_uid: engineUid || 0,
      settings,
    };
    const issues = getIvrPromptsValidationIssues([draft], { engines: engineOptions });
    if (issues.length > 0) {
      toast.error(getPhraseValidationMessage(issues[0], t));
      return;
    }
    onChange([...value, draft]);
    setPhraseIds((ids) => [...ids, newPhraseId()]);
    setTtsText('');
    setTtsEngineUid('');
    setTtsSettings({});
  };

  const playPreviewBlob = async (blob: Blob) => {
    const el = audioRef.current;
    if (!el) return;
    stopAudio();
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    el.src = url;
    el.onended = () => setPlayingPromptUid(null);
    el.onerror = () => {
      stopAudio();
      toast.error(t('ivrs.prompts.previewError', 'Не удалось синтезировать фразу'));
    };
    await el.play();
  };

  const playPromptByFilename = async (filename: string) => {
    const prompt = allPrompts.find((p) => p.filename === filename);
    if (!prompt) {
      toast.error(t('ivrs.prompts.audioNotFound', 'Запись не найдена'));
      return;
    }

    if (playingPromptUid === prompt.uid) {
      stopAudio();
      return;
    }

    const el = audioRef.current;
    if (!el) return;
    stopAudio();
    el.src = `/api/prompts/${prompt.uid}/stream`;
    el.onended = () => setPlayingPromptUid(null);
    el.onerror = () => {
      stopAudio();
      toast.error(t('ivrs.prompts.audioPlayError', 'Не удалось воспроизвести запись'));
    };
    setPlayingPromptUid(prompt.uid);
    try {
      await el.play();
    } catch {
      stopAudio();
      toast.error(t('ivrs.prompts.audioPlayError', 'Не удалось воспроизвести запись'));
    }
  };

  const handlePreviewNew = async () => {
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
      await playPreviewBlob(blob);
    } catch (err: any) {
      toast.error(
        err?.data?.message || t('ivrs.prompts.previewError', 'Не удалось синтезировать фразу'),
      );
    }
  };

  const handlePreviewRow = async (
    text: string,
    engineUid: number,
    settings?: IIvrPhraseTtsSettings,
  ) => {
    if (!text.trim() || !engineUid) {
      toast.warning(t('ivrs.prompts.ttsRequired', 'Укажите текст и TTS-движок'));
      return;
    }
    try {
      const blob = await previewTts({
        text: text.trim(),
        engine_uid: engineUid,
        settings,
      }).unwrap();
      await playPreviewBlob(blob);
    } catch (err: any) {
      toast.error(
        err?.data?.message || t('ivrs.prompts.previewError', 'Не удалось синтезировать фразу'),
      );
    }
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    setPhraseIds((ids) => ids.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = phraseIds.indexOf(String(active.id));
    const newIndex = phraseIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    onChange(arrayMove(value, oldIndex, newIndex));
    setPhraseIds((ids) => arrayMove(ids, oldIndex, newIndex));
  };

  const usedAudioFilenames = new Set(
    value.filter((p): p is Extract<IIvrPhrase, { kind: 'audio' }> => p.kind === 'audio').map((p) => p.filename),
  );
  const availablePrompts = allPrompts.filter((p) => !usedAudioFilenames.has(p.filename));

  const sortableIds = phraseIds.length === value.length
    ? phraseIds
    : value.map((_, i) => phraseIds[i] ?? newPhraseId());

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

        {value.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <VStack gap="8" className={cls.phraseList}>
                {value.map((phrase, index) => (
                  <SortableIvrPhraseItem
                    key={sortableIds[index]}
                    id={sortableIds[index]}
                    index={index}
                    phrase={phrase}
                    engines={engines}
                    engineOptions={engineOptions}
                    getPromptLabel={getPromptLabel}
                    onUpdate={updatePhrase}
                    onRemove={handleRemove}
                    onPreviewTts={handlePreviewRow}
                    onPreviewAudio={playPromptByFilename}
                    isPreviewLoading={isPreviewLoading}
                    isAudioPlaying={
                      phrase.kind === 'audio'
                      && playingPromptUid != null
                      && allPrompts.some(
                        (p) => p.uid === playingPromptUid && p.filename === phrase.filename,
                      )
                    }
                    hasError={invalidPhraseIndexes.includes(index)}
                  />
                ))}
              </VStack>
            </SortableContext>
          </DndContext>
        )}

        <div className={cls.addSection}>
          <HStack gap="8" className={cls.modeToggle}>
            <Button
              type="button"
              variant={addMode === 'audio' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                stopAudio();
                setAddMode('audio');
              }}
            >
              <Volume2 size={14} />
              {t('ivrs.prompts.modeAudio', 'Запись')}
            </Button>
            <Button
              type="button"
              variant={addMode === 'tts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                stopAudio();
                setAddMode('tts');
              }}
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
                onChange={(e) => {
                  stopAudio();
                  setSelectedPrompt(e.target.value);
                }}
              >
                <option value="">{t('ivrs.prompts.selectPrompt', 'Выберите запись')}</option>
                {availablePrompts.map((p) => (
                  <option key={p.uid} value={p.filename}>
                    {p.comment || p.filename}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (selectedPrompt) void playPromptByFilename(selectedPrompt);
                }}
                disabled={!selectedPromptRecord}
                className={cls.addBtn}
                title={t('ivrs.prompts.preview', 'Прослушать')}
              >
                {playingPromptUid != null && selectedPromptRecord?.uid === playingPromptUid
                  ? t('ivrs.prompts.stop', 'Стоп')
                  : t('ivrs.prompts.preview', 'Прослушать')}
              </Button>
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
                  onClick={handlePreviewNew}
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
