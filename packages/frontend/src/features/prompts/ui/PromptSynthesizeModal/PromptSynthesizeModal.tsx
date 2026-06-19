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
  useSynthesizePromptMutation,
} from '@/shared/api/endpoints/promptsApi';
import { useGetTtsEnginesQuery } from '@/shared/api/endpoints/ttsEnginesApi';
import { IvrPhraseTtsFields } from '@/features/ivrs/ui/IvrPhraseTtsFields/IvrPhraseTtsFields';
import {
  getIvrPromptsValidationIssues,
  type IIvrPhrase,
  type IIvrPhraseTtsSettings,
} from '@krasterisk/shared';
import { getPhraseValidationMessage } from '@/features/ivrs/lib/ivrPromptsValidation';

interface PromptSynthesizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PromptSynthesizeModal({ isOpen, onClose }: PromptSynthesizeModalProps) {
  const { t } = useTranslation();
  const { data: engines = [] } = useGetTtsEnginesQuery(undefined, { skip: !isOpen });
  const [previewTts, { isLoading: isPreviewLoading }] = usePreviewPromptTtsMutation();
  const [synthesizePrompt, { isLoading: isSaving }] = useSynthesizePromptMutation();

  const [text, setText] = useState('');
  const [engineUid, setEngineUid] = useState('');
  const [ttsSettings, setTtsSettings] = useState<IIvrPhraseTtsSettings>({});
  const [comment, setComment] = useState('');
  const [description, setDescription] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedEngine = engines.find((e) => String(e.uid) === engineUid) ?? null;

  const engineOptions = engines.map((e) => ({
    uid: e.uid,
    type: e.type,
    settings: e.settings,
  }));

  useEffect(() => {
    if (!isOpen) {
      setText('');
      setEngineUid('');
      setTtsSettings({});
      setComment('');
      setDescription('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (text.trim() && !comment.trim()) {
      const auto = text.trim().slice(0, 80);
      setComment((prev) => (prev ? prev : auto));
    }
  }, [text, comment]);

  const buildDraftPhrase = (): Extract<IIvrPhrase, { kind: 'tts' }> | null => {
    const uid = parseInt(engineUid, 10);
    if (!text.trim() || !uid) return null;
    return {
      kind: 'tts',
      text: text.trim(),
      engine_uid: uid,
      settings: Object.keys(ttsSettings).length ? ttsSettings : undefined,
    };
  };

  const validateDraft = (): boolean => {
    const draft = buildDraftPhrase();
    if (!draft) {
      toast.warning(t('ivrs.prompts.ttsRequired', 'Укажите текст и TTS-движок'));
      return false;
    }
    const issues = getIvrPromptsValidationIssues([draft], { engines: engineOptions });
    if (issues.length > 0) {
      toast.error(getPhraseValidationMessage(issues[0], t));
      return false;
    }
    return true;
  };

  const playPreviewBlob = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.src = url;
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  };

  const handlePreview = async () => {
    if (!validateDraft()) return;
    const draft = buildDraftPhrase()!;
    try {
      const blob = await previewTts({
        text: draft.text,
        engine_uid: draft.engine_uid,
        settings: draft.settings,
      }).unwrap();
      await playPreviewBlob(blob);
    } catch (err: any) {
      toast.error(
        err?.data?.message || t('ivrs.prompts.previewError', 'Не удалось синтезировать фразу'),
      );
    }
  };

  const handleSave = async () => {
    if (!validateDraft()) return;
    if (!comment.trim()) {
      toast.warning(t('promptsPage.upload.nameLabel', 'Укажите название записи'));
      return;
    }
    const draft = buildDraftPhrase()!;
    try {
      await synthesizePrompt({
        text: draft.text,
        engine_uid: draft.engine_uid,
        comment: comment.trim(),
        description: description.trim() || undefined,
        settings: draft.settings,
      }).unwrap();
      onClose();
    } catch (err: any) {
      toast.error(
        err?.data?.message || t('promptsPage.synthesize.saveError', 'Не удалось сохранить запись'),
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('promptsPage.synthesize.title', 'Синтез речи')}</DialogTitle>
        </DialogHeader>

        <VStack gap="16">
          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">
              {t('promptsPage.synthesize.textLabel', 'Текст для синтеза')} *
            </label>
            <Textarea
              placeholder={t('promptsPage.synthesize.textPlaceholder', 'Добро пожаловать...')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
            />
          </VStack>

          <VStack gap="4">
            <Text variant="small">{t('promptsPage.synthesize.engineLabel', 'TTS-движок')} *</Text>
            <Select value={engineUid} onChange={(e) => setEngineUid(e.target.value)}>
              <option value="">{t('promptsPage.synthesize.engineSelect', '— Выберите движок —')}</option>
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

          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">
              {t('promptsPage.upload.nameLabel', 'Название записи')} *
            </label>
            <Input
              placeholder={t('promptsPage.upload.namePlaceholder', 'Например: Приветствие основное')}
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
          <HStack gap="8" className="w-full flex-wrap justify-end">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={isPreviewLoading || !text.trim() || !engineUid}
            >
              {t('promptsPage.synthesize.preview', 'Прослушать')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !text.trim() || !engineUid || !comment.trim()}
            >
              {isSaving
                ? t('common.loading', 'Сохранение...')
                : t('promptsPage.synthesize.save', 'Сохранить как запись')}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
