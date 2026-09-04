import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutTemplate } from 'lucide-react';
import type { IRouteAction, IRouteTemplate } from '@krasterisk/shared';
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
import { DialplanAppsEditor, allowedTypesForHost } from '@/features/dialplan-apps';
import {
  useCreateRouteTemplateMutation,
  useUpdateRouteTemplateMutation,
} from '@/shared/api/endpoints/routeTemplateApi';
import { buildTemplatePayload, detectTemplateSlots } from '../../model/detectTemplateSlots';
import { SLOT_KIND_LABEL_FALLBACK, SLOT_KIND_LABEL_KEY } from '../../model/slotCatalog';
import styles from './RouteTemplateFormModal.module.scss';

export type TemplateModalMode = 'create' | 'edit' | 'copy';

export interface RouteTemplateFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modalMode: TemplateModalMode;
  template?: IRouteTemplate | null;
}

function isBuiltin(row: IRouteTemplate | null | undefined): boolean {
  return row != null && row.vpbx_user_uid == null;
}

export function RouteTemplateFormModal({
  open,
  onOpenChange,
  modalMode,
  template,
}: RouteTemplateFormModalProps) {
  const { t } = useTranslation();
  const [createTemplate, { isLoading: creating }] = useCreateRouteTemplateMutation();
  const [updateTemplate, { isLoading: updating }] = useUpdateRouteTemplateMutation();

  const [mode, setMode] = useState<TemplateModalMode>(modalMode);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [actions, setActions] = useState<IRouteAction[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => detectTemplateSlots(actions), [actions]);
  const existingSlots = template?.slots ?? [];
  const showSlots = candidates.length > 0 || existingSlots.length > 0;

  useEffect(() => {
    if (!open) return;
    setMode(modalMode);
    setName(modalMode === 'copy' || modalMode === 'create' ? '' : (template?.name ?? ''));
    setDescription(template?.description ?? '');
    setActions(template?.actions ? structuredClone(template.actions) : []);
    setChecked(detectTemplateSlots(template?.actions ?? []).map((item) => item.id));
    setError(null);
  }, [open, modalMode, template]);

  const title = mode === 'edit'
    ? t('routes.templates.editTitle', 'Изменить шаблон')
    : mode === 'copy'
      ? t('routes.templates.copyTitle', 'Копировать шаблон')
      : t('routes.templates.createTitle', 'Новый шаблон');

  const switchToCopy = () => {
    setMode('copy');
    setName('');
    setError(null);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (mode === 'edit' && isBuiltin(template)) {
      setError(t('routes.templates.builtinReadOnly', 'Встроенный шаблон нельзя изменить. Сохраните свою копию'));
      return;
    }

    const payload = buildTemplatePayload(actions, checked, candidates);
    const slots = payload.slots.length > 0 ? payload.slots : existingSlots;
    const body = {
      name: trimmed,
      description: description.trim() || undefined,
      actions: payload.actions,
      slots,
    };

    setError(null);
    try {
      if (mode === 'edit' && template) {
        await updateTemplate({ uid: template.uid, data: body }).unwrap();
      } else {
        await createTemplate(body).unwrap();
      }
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
      <DialogContent size="large" className={styles.dialog} aria-describedby={undefined}>
        <DialogHeader className={styles.header}>
          <DialogTitle>
            <HStack gap="8" align="center">
              <LayoutTemplate size={20} />
              <Text as="span" variant="h4">{title}</Text>
            </HStack>
          </DialogTitle>
        </DialogHeader>

        <VStack gap="16" className={styles.scrollBody} max>
          <VStack gap="8" max>
            <Label htmlFor="template-form-name">{`${t('routes.templates.name', 'Название')} *`}</Label>
            <Input
              id="template-form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </VStack>
          <VStack gap="8" max>
            <Label htmlFor="template-form-description">{t('routes.templates.description', 'Описание')}</Label>
            <Textarea
              id="template-form-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </VStack>

          <DialplanAppsEditor
            host="route"
            density="comfortable"
            allowedTypes={allowedTypesForHost('route')}
            actions={actions}
            onChange={setActions}
            slots={existingSlots}
          />

          {showSlots ? (
            <VStack gap="8" max>
              <Text variant="h4">{t('routes.templates.slotsSection', 'Что спрашивать при применении')}</Text>
              <Text variant="muted">
                {t('routes.templates.slotsHint', 'Отмеченные значения шаблон не запомнит, а спросит каждый раз')}
              </Text>
              {existingSlots.map((slot) => (
                <HStack key={slot.id} gap="8" align="center">
                  <Checkbox id={`existing-${slot.id}`} checked readOnly />
                  <Label htmlFor={`existing-${slot.id}`}>
                    {`${slot.label} · ${t(SLOT_KIND_LABEL_KEY[slot.kind], SLOT_KIND_LABEL_FALLBACK[slot.kind])}`}
                  </Label>
                </HStack>
              ))}
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
                    <Label htmlFor={item.id}>{`${item.label} · ${kindLabel}`}</Label>
                  </HStack>
                );
              })}
            </VStack>
          ) : null}

          {error ? (
            <VStack gap="8">
              <Text variant="error">{error}</Text>
              {mode === 'edit' && isBuiltin(template) ? (
                <Button type="button" variant="outline" onClick={switchToCopy}>
                  {t('routes.templates.saveCopy', 'Сохранить копию')}
                </Button>
              ) : null}
            </VStack>
          ) : null}
        </VStack>

        <DialogFooter className={styles.footer}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!name.trim() || creating || updating}
          >
            {t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
