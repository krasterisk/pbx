import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useCreateProvisionTemplateMutation, useUpdateProvisionTemplateMutation } from '@/shared/api/api';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { provisionTemplatesActions } from '../../model/slice/provisionTemplatesSlice';
import {
  selectProvisionTemplatesIsModalOpen,
  selectProvisionTemplatesSelectedTemplate,
} from '../../model/selectors/provisionTemplatesSelectors';

export const ProvisionTemplateFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const isOpen = useAppSelector(selectProvisionTemplatesIsModalOpen);
  const selectedTemplate = useAppSelector(selectProvisionTemplatesSelectedTemplate);
  const isEditing = !!selectedTemplate;

  const onClose = () => dispatch(provisionTemplatesActions.closeModal());

  const [createTemplate, { isLoading: isCreating }] = useCreateProvisionTemplateMutation();
  const [updateTemplate, { isLoading: isUpdating }] = useUpdateProvisionTemplateMutation();

  const isLoading = isCreating || isUpdating;

  const [formData, setFormData] = useState({
    name: '',
    vendor: '',
    model: '',
    content: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (selectedTemplate) {
        setFormData({
          name: selectedTemplate.name || '',
          vendor: selectedTemplate.vendor || '',
          model: selectedTemplate.model || '',
          content: selectedTemplate.content || '',
        });
      } else {
        setFormData({
          name: '',
          vendor: '',
          model: '',
          content: '',
        });
      }
    }
  }, [isOpen, selectedTemplate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateTemplate({ id: selectedTemplate!.uid, data: formData }).unwrap();
      } else {
        await createTemplate(formData).unwrap();
      }
      onClose();
    } catch (err) {
      console.error('Failed to save provision template:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isEditing
              ? t('provisionTemplates.edit', 'Редактировать шаблон')
              : t('provisionTemplates.add', 'Добавить шаблон')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden" autoComplete="off">
          <div className="flex-1 overflow-y-auto pr-1 py-4">
            <VStack gap="16" max>
              <VStack gap="8" max>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('provisionTemplates.name', 'Имя шаблона')} *
                </label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Yealink T2X Base"
                />
              </VStack>

              <HStack gap="16" max className="grid grid-cols-1 sm:flex">
                <VStack gap="8" className="flex-1" max>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('provisionTemplates.vendor', 'Вендор')}
                  </label>
                  <Input
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    placeholder="Например: Yealink"
                  />
                </VStack>
                <VStack gap="8" className="flex-1" max>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('provisionTemplates.model', 'Модель')}
                  </label>
                  <Input
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Например: T21P_E2"
                  />
                </VStack>
              </HStack>

              <VStack gap="8" max>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('provisionTemplates.content', 'Текст шаблона (XML/CFG)')}
                </label>
                <textarea
                  className="flex min-h-[400px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder={'account.1.label = $display_name\naccount.1.auth_name = $username\n...'}
                />
              </VStack>
            </VStack>
          </div>

          <DialogFooter className="mt-4 shrink-0">
            <HStack gap="8" justify="end" max>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                {t('common.cancel', 'Отмена')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save', 'Сохранить')}
              </Button>
            </HStack>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
