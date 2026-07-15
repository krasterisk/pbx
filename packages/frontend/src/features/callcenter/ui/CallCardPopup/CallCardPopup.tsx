import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Star } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
  Button, Text, HStack, VStack,
} from '@/shared/ui';
import { useSaveCardMutation } from '@/shared/api/endpoints/callCenterApi';
import { FieldRenderer } from '../FieldRenderer';
import type { ICardField, ICardTemplate } from '@/features/callcenter/model/types/callCard';
import type { CallCardContext } from '@/features/callcenter/lib/useCallCardPopup';
import styles from './CallCardPopup.module.scss';

export interface CallCardPopupProps {
  open: boolean;
  template: ICardTemplate | null;
  initialValues: Record<string, unknown>;
  callContext: CallCardContext | null;
  isVip: boolean;
  wrapupRemaining?: number;
  onClose: () => void;
}

function isFieldVisible(field: ICardField, values: Record<string, unknown>): boolean {
  if (!field.depends_on) return true;
  const parentVal = values[field.depends_on];
  const allowed = field.depends_values ?? [];
  if (!allowed.length) return Boolean(parentVal);
  return allowed.map(String).includes(String(parentVal ?? ''));
}

export const CallCardPopup = memo(({
  open,
  template,
  initialValues,
  callContext,
  isVip,
  wrapupRemaining,
  onClose,
}: CallCardPopupProps) => {
  const { t } = useTranslation();
  const [saveCard, { isLoading }] = useSaveCardMutation();
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (open) setValues({ ...initialValues });
  }, [open, initialValues]);

  const sortedFields = useMemo(
    () => [...(template?.fields ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [template?.fields],
  );

  const handleChange = useCallback((fieldKey: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  const validate = useCallback((): boolean => {
    if (!template) return false;
    for (const field of template.fields ?? []) {
      if (!field.is_required || !isFieldVisible(field, values)) continue;
      const val = values[field.field_key];
      if (val === undefined || val === null || val === '') {
        toast.error(t('callcenter.cards.popup.requiredError'));
        return false;
      }
    }
    return true;
  }, [template, values, t]);

  const handleSave = useCallback(async () => {
    if (!template || !callContext || !validate()) return;

    try {
      await saveCard({
        template_id: template.uid,
        call_uniqueid: callContext.uniqueid,
        caller_id: callContext.callerId,
        queue_name: callContext.queue,
        status: 'saved',
        field_values: values,
      }).unwrap();
      toast.success(t('callcenter.cards.popup.draftSaved'));
      onClose();
    } catch {
      toast.error(t('callcenter.cards.builder.saveError'));
    }
  }, [template, callContext, values, validate, saveCard, onClose, t]);

  if (!template) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className={isVip ? styles.vipBorder : undefined}>
        <SheetHeader>
          <SheetTitle>{t('callcenter.cards.popup.title')}</SheetTitle>
          {callContext ? (
            <VStack gap="4">
              <HStack gap="8" align="center">
                {isVip ? <Star className={styles.vipIcon} /> : null}
                <Text>
                  {t('callcenter.cards.popup.caller')}: {callContext.callerId}
                </Text>
              </HStack>
              <Text variant="muted">
                {t('callcenter.cards.popup.queue')}: {callContext.queue}
              </Text>
              {isVip ? (
                <Text className={styles.vipLabel}>{t('callcenter.cards.popup.vip')}</Text>
              ) : null}
            </VStack>
          ) : null}
        </SheetHeader>

        <div className={styles.body}>
          <div className={styles.fieldGrid}>
            {sortedFields.map((field) => {
              const visible = isFieldVisible(field, values);
              return (
                <div
                  key={field.field_key}
                  className={`${field.width === 'half' ? styles.fieldHalf : styles.fieldFull} ${visible ? styles.fieldVisible : styles.fieldHidden}`}
                >
                  {visible ? (
                    <FieldRenderer
                      field={field}
                      value={values[field.field_key]}
                      onChange={(v) => handleChange(field.field_key, v)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <SheetFooter>
          {typeof wrapupRemaining === 'number' && wrapupRemaining > 0 ? (
            <Text variant="muted" className={styles.wrapupCountdown}>
              {t('callcenter.agent.wrapupRemaining')}: {wrapupRemaining}s
            </Text>
          ) : null}
          <HStack gap="8">
            <Button variant="outline" onClick={onClose}>
              {t('callcenter.cards.popup.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {t('callcenter.cards.popup.save')}
            </Button>
          </HStack>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
});

CallCardPopup.displayName = 'CallCardPopup';
