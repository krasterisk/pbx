import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import type { IRouteAction } from '@krasterisk/shared';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Text,
  Textarea,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useCreateRouteTemplateMutation } from '@/shared/api/endpoints/routeTemplateApi';
import { buildTemplatePayload, detectTemplateSlots } from '../../model/detectTemplateSlots';
import { SLOT_KIND_LABEL_FALLBACK, SLOT_KIND_LABEL_KEY } from '../../model/slotCatalog';
import { TemplateActionPreview } from '../TemplateActionPreview/TemplateActionPreview';
import styles from './SaveAsTemplateDialog.module.scss';

export interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: IRouteAction[];
}

export function SaveAsTemplateDialog({ open, onOpenChange, actions }: SaveAsTemplateDialogProps) {
  const { t } = useTranslation();
  const [createTemplate, { isLoading }] = useCreateRouteTemplateMutation();
  const candidates = useMemo(() => detectTemplateSlots(actions), [actions]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setChecked(candidates.map((item) => item.id));
    setError(null);
  }, [open, candidates]);

  const selected = useMemo(
    () => buildTemplatePayload(actions, checked, candidates),
    [actions, candidates, checked],
  );

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || actions.length === 0) return;
    setError(null);
    try {
      await createTemplate({
        name: trimmed,
        description: description.trim() || undefined,
        actions: selected.actions,
        slots: selected.slots,
      }).unwrap();
      onOpenChange(false);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(
        status === 409
          ? t('routes.templates.nameTaken', 'Шаблон с таким названием уже есть')
          : t('routes.templates.saveError', 'Не удалось сохранить шаблон, попробуйте ещё раз'),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog} aria-describedby={undefined}>
        <DialogHeader className={styles.header}>
          <DialogTitle>
            <HStack gap="8" align="center">
              <Save size={18} />
              <Text as="span" variant="h4">
                {t('routes.templates.saveAsTemplate', 'Сохранить как шаблон')}
              </Text>
            </HStack>
          </DialogTitle>
        </DialogHeader>

        <VStack gap="16" className={styles.scrollBody} max>
          <VStack gap="8" max>
            <Label htmlFor="template-save-name">
              {`${t('routes.templates.name', 'Название')} *`}
            </Label>
            <Input
              id="template-save-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </VStack>
          <VStack gap="8" max>
            <Label htmlFor="template-save-description">
              {t('routes.templates.description', 'Описание')}
            </Label>
            <Textarea
              id="template-save-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </VStack>

          {candidates.length > 0 ? (
            <VStack gap="8" max>
              <Text variant="h4">{t('routes.templates.slotsSection', 'Что спрашивать при применении')}</Text>
              <Text variant="muted">
                {t('routes.templates.slotsHint', 'Отмеченные значения шаблон не запомнит, а спросит каждый раз')}
              </Text>
              {candidates.map((item) => {
                const kindLabel = t(SLOT_KIND_LABEL_KEY[item.kind], SLOT_KIND_LABEL_FALLBACK[item.kind]);
                return (
                  <HStack key={item.id} gap="8" align="center">
                    <Checkbox
                      id={item.id}
                      checked={checked.includes(item.id)}
                      onChange={(e) => {
                        const on = e.currentTarget.checked;
                        setChecked((prev) =>
                          on ? [...prev, item.id] : prev.filter((id) => id !== item.id),
                        );
                      }}
                    />
                    <Label htmlFor={item.id}>
                      {`${item.label} · ${kindLabel}`}
                    </Label>
                  </HStack>
                );
              })}
            </VStack>
          ) : null}

          <TemplateActionPreview actions={selected.actions} slots={selected.slots} />
          {error ? <Text variant="error">{error}</Text> : null}
        </VStack>

        <DialogFooter className={styles.footer}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!name.trim() || actions.length === 0 || isLoading}
          >
            {t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
