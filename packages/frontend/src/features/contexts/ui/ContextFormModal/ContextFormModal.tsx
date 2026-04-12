import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useCreateContextMutation, useUpdateContextMutation } from '@/shared/api/api';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { contextsActions } from '../../model/slice/contextsSlice';
import {
  selectContextsIsModalOpen,
  selectContextsSelectedContext,
} from '../../model/selectors/contextsSelectors';

export const ContextFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const isOpen = useAppSelector(selectContextsIsModalOpen);
  const selectedContext = useAppSelector(selectContextsSelectedContext);
  const isEditing = !!selectedContext;

  const onClose = () => dispatch(contextsActions.closeModal());

  const [createContext, { isLoading: isCreating }] = useCreateContextMutation();
  const [updateContext, { isLoading: isUpdating }] = useUpdateContextMutation();

  const isLoading = isCreating || isUpdating;

  const [formData, setFormData] = useState({
    name: '',
    comment: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (selectedContext) {
        setFormData({
          name: selectedContext.name || '',
          comment: selectedContext.comment || '',
        });
      } else {
        setFormData({
          name: '',
          comment: '',
        });
      }
    }
  }, [isOpen, selectedContext]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateContext({ uid: selectedContext!.uid, data: formData }).unwrap();
      } else {
        await createContext(formData).unwrap();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save context:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('contexts.edit', 'Редактировать контекст')
              : t('contexts.add', 'Добавить контекст')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} autoComplete="off">
          <VStack gap="16" className="py-4" max>
            <VStack gap="8" max>
              <label className="text-sm font-medium text-muted-foreground">
                {t('contexts.name', 'Имя контекста')} *
              </label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('contexts.namePlaceholder', 'from-internal')}
              />
            </VStack>

            <VStack gap="8" max>
              <label className="text-sm font-medium text-muted-foreground">
                {t('contexts.description', 'Описание')}
              </label>
              <Input
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                placeholder={t('contexts.descPlaceholder', 'Внутренняя маршрутизация')}
              />
            </VStack>
          </VStack>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save', 'Сохранить')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
