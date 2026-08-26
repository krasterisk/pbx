import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/Dialog';
import { Button, Input, Textarea, VStack, HStack, Select, Text } from '@/shared/ui';
import {
  usePreviewPromptTtsMutation,
  useUpdatePromptMutation,
} from '@/shared/api/endpoints/promptsApi';
import { useGetTtsEnginesQuery } from '@/shared/api/endpoints/ttsEnginesApi';
import { IvrPhraseTtsFields } from '@/features/ivrs/ui/IvrPhraseTtsFields/IvrPhraseTtsFields';
import {
  getIvrPromptsValidationIssues,
  type IIvrPhraseTtsSettings,
} from '@krasterisk/shared';
import { getPhraseValidationMessage } from '@/features/ivrs/lib/ivrPromptsValidation';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { getPromptsSelectedPrompt } from '../../model/selectors/promptsSelectors';

interface PromptEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PromptEditModal({ isOpen, onClose }: PromptEditModalProps) {
  const { t } = useTranslation();
  const selected = useAppSelector(getPromptsSelectedPrompt);
  const { data: engines = [] } = useGetTtsEnginesQuery(undefined, { skip: !isOpen });
  const [updatePrompt, { isLoading }] = useUpdatePromptMutation();
  const [previewTts, { isLoading: isPreviewLoading }] = usePreviewPromptTtsMutation();

  const [comment, setComment] = useState('');
  const [description, setDescription] = useState('');
  const [ttsText, setTtsText] = useState('');
  const [ttsEngineUid, setTtsEngineUid] = useState('');
  const [ttsSettings, setTtsSettings] = useState<IIvrPhraseTtsSettings>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isTts = selected?.source_type === 'tts';

  const selectedEngine = engines.find((e) => String(e.uid) === ttsEngineUid) ?? null;
  const engineOptions = engines.map((e) => ({
    uid: e.uid,
    type: e.type,
    settings: e.settings,
  }));

  useEffect(() => {
    if (isOpen && selected) {
      setComment(selected.comment || '');
      setDescription(selected.description || '');
      if (selected.source_type === 'tts' && selected.tts) {
        setTtsText(selected.tts.text || '');
        setTtsEngineUid(String(selected.tts.engine_uid || ''));
        setTtsSettings(selected.tts.settings ?? {});
      } else {
        setTtsText('');
        setTtsEngineUid('');
        setTtsSettings({});
      }
    }
  }, [isOpen, selected]);

  const validateTts = (): boolean => {
    const engineUid = parseInt(ttsEngineUid, 10);
    if (!ttsText.trim() || !engineUid) {
      toast.warning(t('ivrs.prompts.ttsRequired', 'Укажите текст и TTS-движок'));
      return false;
    }
    const issues = getIvrPromptsValidationIssues(
      [{ kind: 'tts', text: ttsText.trim(), engine_uid: engineUid, settings: ttsSettings }],
      { engines: engineOptions },
    );
    if (issues.length > 0) {
      toast.error(getPhraseValidationMessage(issues[0], t));
      return false;
    }
    return true;
  };

  const handlePreview = async () => {
    if (!validateTts()) return;
    try {
      const blob = await previewTts({
        text: ttsText.trim(),
        engine_uid: parseInt(ttsEngineUid, 10),
        settings: Object.keys(ttsSettings).length ? ttsSettings : undefined,
      }).unwrap();
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (err: any) {
      toast.error(
        err?.data?.message || t('ivrs.prompts.previewError', 'Не удалось синтезировать фразу'),
      );
    }
  };

  const handleSubmit = async () => {
    if (!selected || !comment.trim()) return;
    if (isTts && !validateTts()) return;

    try {
      await updatePrompt({
        uid: selected.uid,
        comment: comment.trim(),
        description: description.trim(),
        ...(isTts
          ? {
              tts: {
                text: ttsText.trim(),
                engine_uid: parseInt(ttsEngineUid, 10),
                settings: Object.keys(ttsSettings).length ? ttsSettings : undefined,
              },
            }
          : {}),
      }).unwrap();
      onClose();
    } catch (err: any) {
      toast.error(
        err?.data?.message || t('promptsPage.edit.saveError', 'Не удалось сохранить запись'),
      );
    }
  };

  if (!selected) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isTts
              ? t('promptsPage.edit.ttsTitle', 'Редактировать TTS-запись')
              : t('promptsPage.edit.title', 'Редактировать запись')}
          </DialogTitle>
        </DialogHeader>

        <VStack gap="16">
          <Text variant="muted" className="text-sm">
            {isTts
              ? t('promptsPage.type.tts', 'Синтез речи')
              : t('promptsPage.type.file', 'Аудиофайл')}
          </Text>

          {isTts && (
            <>
              <VStack gap="4">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('promptsPage.synthesize.textLabel', 'Текст для синтеза')} *
                </label>
                <Textarea
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  rows={4}
                />
              </VStack>

              <VStack gap="4">
                <Text variant="small">{t('promptsPage.synthesize.engineLabel', 'TTS-движок')} *</Text>
                <Select value={ttsEngineUid} onChange={(e) => setTtsEngineUid(e.target.value)}>
                  <option value="">{t('promptsPage.synthesize.engineSelect', 'Выберите движок')}</option>
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

              <Button
                type="button"
                variant="outline"
                onClick={handlePreview}
                disabled={isPreviewLoading || !ttsText.trim() || !ttsEngineUid}
              >
                {t('promptsPage.synthesize.preview', 'Прослушать')}
              </Button>
            </>
          )}

          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">
              {t('promptsPage.upload.nameLabel', 'Название записи')} *
            </label>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </VStack>

          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">
              {t('promptsPage.upload.descriptionLabel', 'Комментарий')}
            </label>
            <Textarea
              placeholder={t('promptsPage.upload.descriptionPlaceholder', 'Комментарий')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </VStack>
        </VStack>

        <DialogFooter>
          <HStack gap="8" className="w-full justify-end">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button onClick={handleSubmit} disabled={!comment.trim() || isLoading}>
              {isLoading ? t('common.loading', 'Сохранение...') : t('common.save', 'Сохранить')}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
