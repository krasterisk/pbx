import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/Dialog';
import { Button, Input, Textarea, VStack, HStack, Select, Text } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { useRecordPromptMutation } from '@/shared/api/endpoints/promptsApi';
import { useGetEndpointsQuery } from '@/shared/api/endpoints/endpointApi';

interface PromptRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PromptRecordModal({ isOpen, onClose }: PromptRecordModalProps) {
  const { t } = useTranslation();
  const [recordPrompt, { isLoading }] = useRecordPromptMutation();
  const { data: endpoints = [], isLoading: endpointsLoading, isError: endpointsError } =
    useGetEndpointsQuery(undefined, { skip: !isOpen });

  const [exten, setExten] = useState('');
  const [comment, setComment] = useState('');
  const [description, setDescription] = useState('');
  const [initiated, setInitiated] = useState(false);

  const handleRecord = async () => {
    if (!exten.trim() || !comment.trim()) return;

    try {
      await recordPrompt({
        exten: exten.trim(),
        comment: comment.trim(),
        description: description.trim() || undefined,
      }).unwrap();
      setInitiated(true);
    } catch (err) {
      console.error('Record failed', err);
    }
  };

  const handleClose = () => {
    setExten('');
    setComment('');
    setDescription('');
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
            {endpointsError ? (
              <Text variant="small" className="text-destructive">
                {t('common.loadError', 'Ошибка загрузки')}
              </Text>
            ) : (
              <Select
                value={exten}
                onChange={(e) => setExten(e.target.value)}
                disabled={initiated || endpointsLoading}
              >
                <option value="" disabled>
                  {endpointsLoading
                    ? t('common.loading', 'Загрузка...')
                    : t('promptsPage.record.extenSelect', 'Выберите абонента')}
                </option>
                {endpoints
                  .filter((ep) => ep.extension?.trim())
                  .map((ep) => (
                    <option key={ep.id} value={ep.extension}>
                      {ep.extension}
                      {ep.callerid ? ` (${ep.callerid})` : ''}
                    </option>
                  ))}
              </Select>
            )}
          </VStack>

          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">
              {t('promptsPage.record.nameLabel', 'Название записи')} *
            </label>
            <Input
              placeholder={t('promptsPage.upload.namePlaceholder', 'Приветствие основное')}
              value={comment}
              onChange={e => setComment(e.target.value)}
              disabled={initiated}
            />
          </VStack>

          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">
              {t('promptsPage.record.descriptionLabel', 'Комментарий')}
            </label>
            <Textarea
              placeholder={t('promptsPage.upload.descriptionPlaceholder', 'Комментарий')}
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={initiated}
              rows={2}
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
