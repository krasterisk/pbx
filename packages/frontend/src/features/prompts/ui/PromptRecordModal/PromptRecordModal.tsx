import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/Dialog';
import { Button, Input, VStack, HStack } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { useRecordPromptMutation } from '@/shared/api/endpoints/promptsApi';

interface PromptRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PromptRecordModal({ isOpen, onClose }: PromptRecordModalProps) {
  const { t } = useTranslation();
  const [recordPrompt, { isLoading }] = useRecordPromptMutation();

  const [exten, setExten] = useState('');
  const [comment, setComment] = useState('');
  const [initiated, setInitiated] = useState(false);

  const handleRecord = async () => {
    if (!exten.trim() || !comment.trim()) return;

    try {
      await recordPrompt({ exten: exten.trim(), comment: comment.trim() }).unwrap();
      setInitiated(true);
    } catch (err) {
      console.error('Record failed', err);
    }
  };

  const handleClose = () => {
    setExten('');
    setComment('');
    setInitiated(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('promptsPage.record.title', 'Запись по телефону')}</DialogTitle>
        </DialogHeader>

        <VStack gap="16">
          <VStack gap="4">
            <HStack align="center" gap="4">
              <label className="text-sm font-medium text-muted-foreground">
                {t('promptsPage.record.extenLabel', 'Внутренний номер для записи')}
              </label>
              <InfoTooltip text={t('promptsPage.record.extenHint', 'На указанный номер поступит вызов. При ответе будет предложено произнести фразу.')} />
            </HStack>
            <Input
              placeholder="101"
              value={exten}
              onChange={e => setExten(e.target.value)}
              disabled={initiated}
            />
          </VStack>

          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">
              {t('promptsPage.record.commentLabel', 'Название записи')} *
            </label>
            <Input
              placeholder={t('promptsPage.upload.commentPlaceholder', 'Приветствие основное')}
              value={comment}
              onChange={e => setComment(e.target.value)}
              disabled={initiated}
            />
          </VStack>

          {initiated && (
            <div className="text-sm text-primary animate-pulse">
              {t('promptsPage.record.recording', 'Запись инициирована...')}
            </div>
          )}
        </VStack>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t('common.cancel', 'Отмена')}</Button>
          {!initiated && (
            <Button
              onClick={handleRecord}
              disabled={!exten.trim() || !comment.trim() || isLoading}
            >
              {t('promptsPage.record.startRecord', 'Начать запись')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
