import { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Trash2, Pencil } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getIvrPromptsValidationIssues,
  type IIvrPhrase,
  type IIvrPhraseTtsSettings,
  type IvrPromptsValidationEngine,
} from '@krasterisk/shared';
import type { ITtsEngine } from '@/entities/engines';
import { Button, Select, Text, Textarea } from '@/shared/ui';
import { VStack, Flex, HStack } from '@/shared/ui/Stack';
import { IvrPhraseTtsFields } from '../IvrPhraseTtsFields/IvrPhraseTtsFields';
import cls from './SortableIvrPhraseItem.module.scss';

export interface SortableIvrPhraseItemProps {
  id: string;
  index: number;
  phrase: IIvrPhrase;
  engines: ITtsEngine[];
  getPromptLabel: (filename: string) => string;
  onUpdate: (index: number, phrase: IIvrPhrase) => void;
  onRemove: (index: number) => void;
  onPreviewTts: (text: string, engineUid: number, settings?: IIvrPhraseTtsSettings) => void;
  onPreviewAudio: (filename: string) => void;
  isPreviewLoading: boolean;
  isAudioPlaying?: boolean;
  engineOptions: IvrPromptsValidationEngine[];
  hasError?: boolean;
}

function summarizeTtsSettings(
  phrase: Extract<IIvrPhrase, { kind: 'tts' }>,
  engineDefaultsLabel: string,
): string {
  const parts: string[] = [];
  if (phrase.settings?.voice) parts.push(phrase.settings.voice);
  if (phrase.settings?.speed) parts.push(String(phrase.settings.speed));
  if (phrase.settings?.speaking_rate) parts.push(String(phrase.settings.speaking_rate));
  return parts.length ? parts.join(', ') : engineDefaultsLabel;
}

export function SortableIvrPhraseItem({
  id,
  index,
  phrase,
  engines,
  getPromptLabel,
  onUpdate,
  onRemove,
  onPreviewTts,
  onPreviewAudio,
  isPreviewLoading,
  isAudioPlaying = false,
  engineOptions,
  hasError = false,
}: SortableIvrPhraseItemProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (hasError && phrase.kind === 'tts') {
      setIsEditing(true);
    }
  }, [hasError, phrase.kind]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.85 : 1,
  };

  const engine = phrase.kind === 'tts'
    ? engines.find((e) => e.uid === phrase.engine_uid) ?? null
    : null;

  const engineName = engine?.name
    ?? (phrase.kind === 'tts' && phrase.engine_uid > 0 ? `#${phrase.engine_uid}` : '—');

  const handleTtsPatch = useCallback(
    (patch: Partial<Extract<IIvrPhrase, { kind: 'tts' }>>) => {
      if (phrase.kind !== 'tts') return;
      onUpdate(index, { ...phrase, ...patch });
    },
    [index, onUpdate, phrase],
  );

  const handlePreview = () => {
    if (phrase.kind === 'audio') {
      onPreviewAudio(phrase.filename);
      return;
    }
    onPreviewTts(phrase.text.trim(), phrase.engine_uid, phrase.settings);
  };

  const rowIssues = phrase.kind === 'tts'
    ? getIvrPromptsValidationIssues([phrase], { engines: engineOptions })
    : [];

  const previewDisabled = phrase.kind === 'tts'
    ? (
      isPreviewLoading
      || !phrase.text.trim()
      || !phrase.engine_uid
      || rowIssues.length > 0
    )
    : !phrase.filename;

  const showError = hasError || rowIssues.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${cls.promptItem} ${isDragging ? cls.promptItemDragging : ''} ${
        phrase.kind === 'tts' ? cls.promptItemTts : ''
      } ${phrase.kind === 'tts' && isEditing ? cls.promptItemTtsExpanded : ''} ${
        showError ? cls.promptItemInvalid : ''
      }`}
    >
      <Flex align="start" gap="8" className={cls.promptRow}>
        <button
          type="button"
          className={cls.dragHandle}
          title={t('ivrs.prompts.dragHandle', 'Перетащите для изменения порядка')}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>

        <Text as="span" className={cls.promptIndex}>
          {index + 1}
        </Text>

        <span className={phrase.kind === 'tts' ? cls.badgeTts : cls.badgeAudio}>
          {phrase.kind === 'tts'
            ? t('ivrs.prompts.badgeTts', 'TTS')
            : t('ivrs.prompts.badgeAudio', 'Аудио')}
        </span>

        {phrase.kind === 'audio' ? (
          <Text as="span" className={cls.promptName}>
            {getPromptLabel(phrase.filename)}
          </Text>
        ) : (
          <div className={cls.ttsBody}>
            {!isEditing ? (
              <Text as="span" className={cls.ttsSummary}>
                {phrase.text.slice(0, 120)}
                {phrase.text.length > 120 ? '…' : ''}
                {' · '}
                {engineName}
                {' · '}
                {summarizeTtsSettings(
                  phrase,
                  t('ivrs.prompts.engineDefaults', 'настройки движка'),
                )}
              </Text>
            ) : (
              <VStack gap="10" className={cls.ttsEdit}>
                <Textarea
                  value={phrase.text}
                  onChange={(e) => handleTtsPatch({ text: e.target.value })}
                  placeholder={t('ivrs.prompts.textPlaceholder', 'Текст фразы для синтеза')}
                  rows={2}
                  className={cls.ttsTextarea}
                />
                <VStack gap="4">
                  <Text variant="small">{t('ivrs.prompts.engine', 'TTS-движок')}</Text>
                  <Select
                    value={phrase.engine_uid > 0 ? String(phrase.engine_uid) : ''}
                    onChange={(e) => {
                      const uid = parseInt(e.target.value, 10);
                      handleTtsPatch({ engine_uid: uid || 0 });
                    }}
                  >
                    <option value="">{t('ivrs.prompts.selectEngine', 'Выберите движок')}</option>
                    {engines.map((eng) => (
                      <option key={eng.uid} value={String(eng.uid)}>
                        {eng.name} ({eng.type})
                      </option>
                    ))}
                  </Select>
                </VStack>
                <IvrPhraseTtsFields
                  engine={engine}
                  settings={phrase.settings ?? {}}
                  onChange={(settings) => handleTtsPatch({
                    settings: Object.keys(settings).length ? settings : undefined,
                  })}
                />
              </VStack>
            )}
          </div>
        )}

        <HStack gap="4" className={cls.rowActions}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={previewDisabled}
            onClick={handlePreview}
          >
            {phrase.kind === 'audio' && isAudioPlaying
              ? t('ivrs.prompts.stop', 'Стоп')
              : t('ivrs.prompts.preview', 'Прослушать')}
          </Button>
          {phrase.kind === 'tts' && (
            isEditing ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={rowIssues.length > 0}
                onClick={() => {
                  if (rowIssues.length > 0) return;
                  setIsEditing(false);
                }}
              >
                {t('ivrs.prompts.collapseEdit', 'Свернуть')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil size={14} />
                {t('common.edit', 'Редактировать')}
              </Button>
            )
          )}
        </HStack>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cls.deleteBtn}
          onClick={() => onRemove(index)}
          title={t('common.delete', 'Удалить')}
        >
          <Trash2 size={14} />
        </Button>
      </Flex>
    </div>
  );
}
