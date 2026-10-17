import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Star } from 'lucide-react';
import { Button, HStack, Text, VStack } from '@/shared/ui';
import { useSaveCardMutation } from '@/shared/api/endpoints/callCenterApi';
import { FieldRenderer } from '../FieldRenderer';
import type { ICardField, ICardTemplate } from '@/features/callcenter/model/types/callCard';
import type { CallCardContext } from '@/features/callcenter/lib/useCallCardPopup';
import styles from './CallCardForm.module.scss';
import { cardChoiceValue } from '@krasterisk/shared';
import { queueDisplayName } from '../../lib/displayLabels';

export interface CallCardFormProps {
  template: ICardTemplate;
  initialValues: Record<string, unknown>;
  callContext: CallCardContext | null;
  isVip: boolean;
  /** Seconds of wrap-up left; shown next to the buttons. */
  wrapupRemaining?: number;
  /** Called after a successful save or on Cancel. */
  onClose: () => void;
  /** Shows the caller / queue summary above the fields (the popup has its own header). */
  showSummary?: boolean;
}

export function isFieldVisible(field: ICardField, values: Record<string, unknown>): boolean {
  if (!field.depends_on) return true;
  const parentVal = values[field.depends_on];
  const allowed = field.depends_values ?? [];
  if (!allowed.length) return Boolean(parentVal);
  return (Array.isArray(parentVal) ? parentVal : [parentVal]).some(value => allowed.includes(cardChoiceValue(value)));
}

/**
 * Client card form of the active call (template fields + Save). Rendered inline in the call
 * layout (U2.2) and inside the legacy popup Sheet.
 */
export const CallCardForm = memo(({
  template,
  initialValues,
  callContext,
  isVip,
  wrapupRemaining,
  onClose,
  showSummary = true,
}: CallCardFormProps) => {
  const { t } = useTranslation();
  const [saveCard, { isLoading }] = useSaveCardMutation();
  const [values, setValues] = useState<Record<string, unknown>>({ ...initialValues });
  const [invalidKeys, setInvalidKeys] = useState<string[]>([]);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const errorPrefix = useId();
  const dirtyRef = useRef(false);
  const draftRef = useRef({ values, callContext, template, saveCard, t });
  draftRef.current = { values, callContext, template, saveCard, t };

  useEffect(() => () => {
    const draft = draftRef.current;
    if (!dirtyRef.current || !draft.template.auto_save_on_timeout || !draft.callContext) return;
    // Flush when wrap-up ends/unmounts. Drafts skip required-field checks and CRM delivery.
    dirtyRef.current = false;
    void draft.saveCard({ template_id: draft.template.uid, call_uniqueid: draft.callContext.uniqueid, caller_id: draft.callContext.callerId, queue_name: draft.callContext.queue, status: 'draft', field_values: draft.values }).unwrap()
      .catch(() => toast.error(draft.t('callcenter.cards.builder.saveError')));
  }, []);

  useEffect(() => {
    setValues({ ...initialValues });
    dirtyRef.current = false;
  }, [initialValues]);

  const sortedFields = useMemo(
    () => [...(template.fields ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [template.fields],
  );

  const handleChange = useCallback((fieldKey: string, value: unknown) => {
    dirtyRef.current = true;
    setInvalidKeys(keys => keys.filter(key => key !== fieldKey));
    setValues((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  const validate = useCallback((): boolean => {
    const missing: string[] = [];
    for (const field of template.fields ?? []) {
      if (!field.is_required || !isFieldVisible(field, values)) continue;
      const val = values[field.field_key];
      if (val === undefined || val === null || val === '' || (Array.isArray(val) && !val.length)) {
        missing.push(field.field_key);
      }
    }
    setInvalidKeys(missing);
    if (missing.length) {
      const first = Array.from(fieldsRef.current?.children ?? []).find(node => node.getAttribute('data-field-key') === missing[0]);
      first?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
      return false;
    }
    return true;
  }, [template, values, t]);

  const handleSave = useCallback(async () => {
    if (!callContext || !validate()) return;
    try {
      await saveCard({
        template_id: template.uid,
        call_uniqueid: callContext.uniqueid,
        caller_id: callContext.callerId,
        queue_name: callContext.queue,
        status: 'saved',
        field_values: values,
      }).unwrap();
      dirtyRef.current = false;
      toast.success(t('callcenter.cards.popup.draftSaved'));
      onClose();
    } catch {
      toast.error(t('callcenter.cards.builder.saveError'));
    }
  }, [template, callContext, values, validate, saveCard, onClose, t]);

  return (
    <VStack gap="12" max className={isVip ? styles.vipBorder : undefined} data-testid="call-card-form">
      {showSummary && callContext ? (
        <VStack gap="4">
          <HStack gap="8" align="center">
            {isVip ? <Star className={styles.vipIcon} aria-hidden="true" /> : null}
            <Text>
              {t('callcenter.cards.popup.caller')}: {callContext.callerId}
            </Text>
            {isVip ? <Text className={styles.vipLabel}>{t('callcenter.cards.popup.vip')}</Text> : null}
          </HStack>
          {callContext.queue ? <Text variant="muted">
            {t('callcenter.cards.popup.queue')}: {queueDisplayName(callContext.queue, [])}
          </Text> : null}
        </VStack>
      ) : null}

      <div className={styles.fieldGrid} ref={fieldsRef}>
        {sortedFields.map((field) => {
          const visible = isFieldVisible(field, values);
          return (
            <div
              key={field.field_key}
              data-field-key={field.field_key}
              className={`${field.width === 'half' ? styles.fieldHalf : styles.fieldFull} ${visible ? styles.fieldVisible : styles.fieldHidden}`}
            >
              {visible ? (
                <FieldRenderer
                  templateId={template.uid}
                  field={field}
                  value={values[field.field_key]}
                  onChange={(v) => handleChange(field.field_key, v)}
                  invalid={invalidKeys.includes(field.field_key)}
                  errorId={`${errorPrefix}-${field.field_key}`}
                />
              ) : null}
              {visible && invalidKeys.includes(field.field_key) ? <div role="alert" id={`${errorPrefix}-${field.field_key}`}><Text variant="error">{t('callcenter.cards.popup.requiredError')}</Text></div> : null}
            </div>
          );
        })}
      </div>

      {typeof values.wrapup_note === 'string' && values.wrapup_note && !sortedFields.some(field => field.field_key === 'wrapup_note') ? (
        <VStack gap="4"><Text variant="muted">{t('callcenter.wrapup.noteLabel', 'Call note')}</Text><Text>{values.wrapup_note}</Text></VStack>
      ) : null}

      <HStack gap="8" align="center" justify="between" max wrap="wrap">
        {typeof wrapupRemaining === 'number' && wrapupRemaining > 0 ? (
          <Text variant="muted" className={styles.wrapupCountdown}>
            {t('callcenter.agent.wrapupRemaining')}: {wrapupRemaining}
            {t('callcenter.agent.secShort', 's')}
          </Text>
        ) : <span />}
        <HStack gap="8">
          <Button variant="outline" onClick={onClose} data-testid="call-card-cancel">
            {t('callcenter.cards.popup.cancel')}
          </Button>
          <Button onClick={() => void handleSave()} disabled={isLoading} data-testid="call-card-save">
            {t('callcenter.cards.popup.save')}
          </Button>
        </HStack>
      </HStack>
    </VStack>
  );
});

CallCardForm.displayName = 'CallCardForm';
