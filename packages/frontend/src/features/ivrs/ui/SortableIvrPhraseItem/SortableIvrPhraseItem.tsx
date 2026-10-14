import { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import {
  getIvrPromptsValidationIssues,
  type IIvrPhrase,
  type IIvrPhraseTtsSettings,
  type IvrPromptsValidationEngine,
} from '@krasterisk/shared';
import type { ITtsEngine } from '@/entities/engines';
import { Button, Select, Text, Textarea, Input, Label, Tooltip, VStack, HStack } from '@/shared/ui';
import { SortableRegionItem, SortableRegionHandle } from '@/shared/ui/SortableRegion';
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

  const engine = phrase.kind === 'tts' ? (engines.find((e) => e.uid === phrase.engine_uid) ?? null) : null;

  const engineName =
    engine?.name ?? (phrase.kind === 'tts' && phrase.engine_uid > 0 ? `#${phrase.engine_uid}` : '-');

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

  const rowIssues =
    phrase.kind === 'tts' ? getIvrPromptsValidationIssues([phrase], { engines: engineOptions }) : [];

  const previewDisabled =
    phrase.kind === 'tts'
      ? isPreviewLoading || !phrase.text.trim() || !phrase.engine_uid || rowIssues.length > 0
      : !phrase.filename;

  const showError = hasError || rowIssues.length > 0;

  const panelId = id + '-settings';
  const title =
    phrase.kind === 'audio' ? getPromptLabel(phrase.filename) : phrase.text || t('ivrs.editor.text');
  return (
    <SortableRegionItem id={id} className={cls.promptItem + (showError ? ' ' + cls.promptItemInvalid : '')}>
      <HStack align="center" gap="8" max className={cls.promptRow}>
        <Tooltip content={t('ivrs.prompts.dragHandle')}>
          <SortableRegionHandle
            className={cls.dragHandle}
            aria-label={t('ivrs.prompts.dragHandle') + ': ' + (index + 1)}
          />
        </Tooltip>
        <Button
          type="button"
          variant="ghost"
          className={cls.toggle}
          aria-expanded={isEditing}
          aria-controls={panelId}
          disabled={isEditing && rowIssues.length > 0}
          onClick={() => setIsEditing((open) => !open)}
        >
          {isEditing ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
          <Text as="span" className={cls.promptIndex}>
            {index + 1}
          </Text>
          <VStack align="stretch" gap="4" className={cls.summary}>
            <Text as="span" className={cls.promptName}>
              {title}
            </Text>
            <Text as="span" variant="muted" className={cls.metadata}>
              {phrase.kind === 'tts'
                ? engineName + ' · ' + summarizeTtsSettings(phrase, t('ivrs.prompts.engineDefaults'))
                : t('ivrs.prompts.badgeAudio')}
            </Text>
          </VStack>
          <Text as="span" className={cls.badge}>
            {t(phrase.kind === 'tts' ? 'ivrs.prompts.badgeTts' : 'ivrs.prompts.badgeAudio')}
          </Text>
        </Button>
        <HStack gap="4" className={cls.rowActions}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={previewDisabled}
            onClick={handlePreview}
          >
            {phrase.kind === 'audio' && isAudioPlaying ? t('ivrs.prompts.stop') : t('ivrs.prompts.preview')}
          </Button>
          <Tooltip content={t('common.delete')}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cls.deleteBtn}
              aria-label={t('common.delete') + ': ' + (index + 1)}
              onClick={() => onRemove(index)}
            >
              <Trash2 size={16} aria-hidden />
            </Button>
          </Tooltip>
        </HStack>
      </HStack>
      {isEditing && (
        <VStack id={panelId} align="stretch" gap="12" max className={cls.itemBody}>
          {phrase.kind === 'audio' ? (
            <VStack align="stretch" gap="4" max>
              <Label htmlFor={id + '-file'}>{t('ivrs.editor.filename')}</Label>
              <Input id={id + '-file'} value={phrase.filename} readOnly />
            </VStack>
          ) : (
            <>
              <VStack align="stretch" gap="4" max>
                <Label htmlFor={id + '-text'}>{t('ivrs.editor.text')}</Label>
                <Textarea
                  id={id + '-text'}
                  value={phrase.text}
                  rows={3}
                  onChange={(event) => handleTtsPatch({ text: event.target.value })}
                  placeholder={t('ivrs.prompts.textPlaceholder')}
                />
              </VStack>
              <VStack align="stretch" gap="4" max>
                <Label htmlFor={id + '-engine'}>{t('ivrs.prompts.engine')}</Label>
                <Select
                  id={id + '-engine'}
                  value={phrase.engine_uid > 0 ? String(phrase.engine_uid) : ''}
                  onChange={(event) => handleTtsPatch({ engine_uid: parseInt(event.target.value, 10) || 0 })}
                >
                  <option value="">{t('ivrs.prompts.selectEngine')}</option>
                  {engines.map((engine) => (
                    <option key={engine.uid} value={String(engine.uid)}>
                      {engine.name} ({engine.type})
                    </option>
                  ))}
                </Select>
              </VStack>
              <IvrPhraseTtsFields
                engine={engine}
                settings={phrase.settings ?? {}}
                onChange={(settings) =>
                  handleTtsPatch({ settings: Object.keys(settings).length ? settings : undefined })
                }
              />
            </>
          )}
        </VStack>
      )}
    </SortableRegionItem>
  );
}
