import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Textarea,
  Text,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useCreateNumberMutation, useUpdateNumberMutation } from '@/shared/api/api';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  getNumbersPageIsModalOpen,
  getNumbersPageSelectedNumber,
  getNumbersPageModalMode,
} from '../../model/selectors/numbersPageSelectors';
import { numbersPageActions } from '../../model/slice/numbersPageSlice';

const DEFAULT_NUMBERS_JSON = '{\n  "queues": [],\n  "operators": [],\n  "cdr": []\n}';

function formatNumbersJson(value: unknown): string {
  if (value == null || value === '') return DEFAULT_NUMBERS_JSON;
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return DEFAULT_NUMBERS_JSON;
  }
}

export const NumberFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const isOpen = useAppSelector(getNumbersPageIsModalOpen);
  const selected = useAppSelector(getNumbersPageSelectedNumber);
  const modalMode = useAppSelector(getNumbersPageModalMode);
  const isEditing = modalMode === 'edit' && !!selected;

  const onClose = () => dispatch(numbersPageActions.closeModal());

  const [createNumber, { isLoading: isCreating }] = useCreateNumberMutation();
  const [updateNumber, { isLoading: isUpdating }] = useUpdateNumberMutation();
  const isLoading = isCreating || isUpdating;

  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [numbersJson, setNumbersJson] = useState(DEFAULT_NUMBERS_JSON);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && selected) {
      setName(selected.name || '');
      setComment(selected.comment || selected.description || '');
      setNumbersJson(formatNumbersJson((selected as { numbers?: unknown }).numbers));
    } else {
      setName('');
      setComment('');
      setNumbersJson(DEFAULT_NUMBERS_JSON);
    }
    setJsonError(null);
  }, [isOpen, isEditing, selected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let numbers: unknown;
    try {
      numbers = JSON.parse(numbersJson);
      setJsonError(null);
    } catch {
      setJsonError(t('numbers.jsonInvalid'));
      return;
    }

    const payload = {
      name: name.trim(),
      comment: comment.trim() || undefined,
      numbers,
    };

    try {
      if (isEditing && selected) {
        await updateNumber({ id: selected.id, data: payload }).unwrap();
      } else {
        await createNumber(payload).unwrap();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save number list:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('numbers.edit') : t('numbers.add')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="py-2" autoComplete="off">
          <VStack gap="16" max>
            <VStack gap="8" max>
              <label className="text-sm font-medium text-muted-foreground" htmlFor="numbers-name">
                {t('numbers.name')} *
              </label>
              <Input
                id="numbers-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </VStack>

            <VStack gap="8" max>
              <label className="text-sm font-medium text-muted-foreground" htmlFor="numbers-comment">
                {t('numbers.comment')}
              </label>
              <Input
                id="numbers-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </VStack>

            <VStack gap="8" max>
              <label className="text-sm font-medium text-muted-foreground" htmlFor="numbers-json">
                {t('numbers.jsonLabel')}
              </label>
              <Text variant="muted" className="text-xs">
                {t('numbers.jsonHint')}
              </Text>
              <Textarea
                id="numbers-json"
                value={numbersJson}
                onChange={(e) => setNumbersJson(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
              {jsonError && (
                <Text className="text-xs text-red-400">{jsonError}</Text>
              )}
            </VStack>
          </VStack>

          <DialogFooter className="mt-6">
            <HStack gap="8" justify="end" max>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading || !name.trim()}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </HStack>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
