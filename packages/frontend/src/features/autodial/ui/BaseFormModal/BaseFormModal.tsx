import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  AUTODIAL_DEDUP_POLICIES,
  AUTODIAL_PHONE_NORMALIZATIONS,
} from '@krasterisk/shared';
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
  Select,
  TableRowAction,
  TableRowActions,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useCreateAutodialBaseMutation,
  useGetAutodialBaseQuery,
  useUpdateAutodialBaseMutation,
} from '@/shared/api/endpoints/autodialApi';
import {
  autodialPageActions,
  selectAutodialActiveBaseUid,
  selectAutodialBaseModalMode,
  selectAutodialBaseModalOpen,
} from '../../model/slice/autodialPageSlice';
import {
  AUTODIAL_FIELD_TYPE_ORDER,
  baseDraftToPayload,
  baseToDraft,
  blankFieldDraft,
  emptyBaseDraft,
  hasBaseErrors,
  suggestVarName,
  validateBaseDraft,
  type AutodialBaseDraft,
  type AutodialFieldDraft,
} from '../../model/baseDraft';
import cls from './BaseFormModal.module.scss';

export const BaseFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectAutodialBaseModalOpen);
  const mode = useAppSelector(selectAutodialBaseModalMode);
  const activeUid = useAppSelector(selectAutodialActiveBaseUid);
  const editUid = mode === 'edit' ? activeUid : null;

  const { data: base, isFetching } = useGetAutodialBaseQuery(editUid as number, {
    skip: !isOpen || editUid === null,
  });
  const [createBase, { isLoading: isCreating }] = useCreateAutodialBaseMutation();
  const [updateBase, { isLoading: isUpdating }] = useUpdateAutodialBaseMutation();

  const [draft, setDraft] = useState<AutodialBaseDraft>(emptyBaseDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setShowErrors(false);
    setApiError(null);
    setDraft(editUid !== null && base ? baseToDraft(base) : emptyBaseDraft());
  }, [isOpen, editUid, base]);

  const errors = useMemo(() => validateBaseDraft(draft), [draft]);
  const visibleErrors = showErrors ? errors : {};
  const isSaving = isCreating || isUpdating;

  const close = () => dispatch(autodialPageActions.closeBaseModal());

  const setFields = (fields: AutodialFieldDraft[]) => setDraft({ ...draft, fields });
  const updateField = (index: number, next: AutodialFieldDraft) =>
    setFields(draft.fields.map((f, i) => (i === index ? next : f)));

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= draft.fields.length) return;
    const next = [...draft.fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  };

  const onSave = async () => {
    if (hasBaseErrors(errors)) {
      setShowErrors(true);
      return;
    }
    setApiError(null);
    const payload = baseDraftToPayload(draft);
    try {
      if (editUid !== null) {
        await updateBase({ uid: editUid, data: payload as never }).unwrap();
      } else {
        const created = await createBase(payload as never).unwrap();
        dispatch(autodialPageActions.selectBase(created.uid));
      }
      close();
    } catch {
      setApiError(t('autodial.bases.saveFailed'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent size="large" className={cls.dialog} data-testid="autodial-base-form-modal">
        <DialogHeader className={cls.header}>
          <DialogTitle>
            {editUid !== null ? t('autodial.bases.editTitle') : t('autodial.bases.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {isFetching && editUid !== null ? (
          <HStack justify="center" align="center" className={cls.body}>
            <Loader2 size={24} className={cls.spinner} />
          </HStack>
        ) : (
          <VStack
            gap="16"
            max
            className={cls.body}
            data-testid="autodial-base-form-body"
            data-viewport="360,768,1440"
            data-overflow="y"
          >
            <div className={cls.grid}>
              <VStack gap="4">
                <Label htmlFor="autodial-base-name">{t('autodial.bases.name')}</Label>
                <Input
                  id="autodial-base-name"
                  value={draft.name}
                  aria-invalid={Boolean(visibleErrors.name) || undefined}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                {visibleErrors.name && (
                  <Text className={cls.error}>{t('common.fieldRequired')}</Text>
                )}
              </VStack>

              <VStack gap="4">
                <Label htmlFor="autodial-base-description">
                  {t('autodial.bases.description')}
                </Label>
                <Input
                  id="autodial-base-description"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </VStack>

              <VStack gap="4">
                <Label htmlFor="autodial-base-dedup">{t('autodial.bases.dedupPolicy')}</Label>
                <Select
                  id="autodial-base-dedup"
                  value={draft.dedup_policy}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      dedup_policy: e.target.value as AutodialBaseDraft['dedup_policy'],
                    })
                  }
                >
                  {AUTODIAL_DEDUP_POLICIES.map((policy) => (
                    <option key={policy} value={policy}>
                      {t(`autodial.bases.dedup.${policy}`)}
                    </option>
                  ))}
                </Select>
              </VStack>

              <VStack gap="4">
                <Label htmlFor="autodial-base-normalization">
                  {t('autodial.bases.phoneNormalization')}
                </Label>
                <Select
                  id="autodial-base-normalization"
                  value={draft.phone_normalization}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      phone_normalization: e.target
                        .value as AutodialBaseDraft['phone_normalization'],
                    })
                  }
                >
                  {AUTODIAL_PHONE_NORMALIZATIONS.map((norm) => (
                    <option key={norm} value={norm}>
                      {t(`autodial.bases.normalization.${norm}`)}
                    </option>
                  ))}
                </Select>
              </VStack>
            </div>

            <VStack gap="8" max>
              <Text className={cls.sectionTitle}>{t('autodial.bases.schema')}</Text>
              <Text className={cls.hint}>{t('autodial.bases.schemaHint')}</Text>

              {draft.fields.map((field, index) => (
                <div key={field.uid ?? `new-${index}`} className={cls.fieldRow}>
                  <div className={cls.fieldGrid}>
                    <VStack gap="4">
                      <Label htmlFor={`autodial-field-key-${index}`}>
                        {t('autodial.bases.fieldKey')}
                      </Label>
                      <Input
                        id={`autodial-field-key-${index}`}
                        value={field.key}
                        aria-invalid={Boolean(visibleErrors.fieldKeys?.[index]) || undefined}
                        onChange={(e) =>
                          updateField(index, {
                            ...field,
                            key: e.target.value,
                            var_name: suggestVarName(e.target.value),
                          })
                        }
                      />
                      {visibleErrors.fieldKeys?.[index] && (
                        <Text className={cls.error}>
                          {t(`autodial.bases.fieldKeyError.${visibleErrors.fieldKeys[index]}`)}
                        </Text>
                      )}
                    </VStack>

                    <VStack gap="4">
                      <Label htmlFor={`autodial-field-label-${index}`}>
                        {t('autodial.bases.fieldLabel')}
                      </Label>
                      <Input
                        id={`autodial-field-label-${index}`}
                        value={field.label}
                        onChange={(e) => updateField(index, { ...field, label: e.target.value })}
                      />
                    </VStack>

                    <VStack gap="4">
                      <Label htmlFor={`autodial-field-type-${index}`}>
                        {t('autodial.bases.fieldType')}
                      </Label>
                      <Select
                        id={`autodial-field-type-${index}`}
                        value={field.type}
                        onChange={(e) => {
                          const type = e.target.value as AutodialFieldDraft['type'];
                          updateField(index, {
                            ...field,
                            type,
                            is_phone: type === 'phone' ? true : field.is_phone,
                          });
                        }}
                      >
                        {AUTODIAL_FIELD_TYPE_ORDER.map((type) => (
                          <option key={type} value={type}>
                            {t(`autodial.bases.fieldTypeLabel.${type}`)}
                          </option>
                        ))}
                      </Select>
                    </VStack>

                    <VStack gap="4">
                      <Label htmlFor={`autodial-field-var-${index}`}>
                        {t('autodial.bases.varName')}
                      </Label>
                      <Input
                        id={`autodial-field-var-${index}`}
                        value={field.var_name}
                        onChange={(e) => updateField(index, { ...field, var_name: e.target.value })}
                      />
                    </VStack>

                    <HStack gap="12" align="center" className={cls.flags}>
                      <HStack gap="4" align="center">
                        <Checkbox
                          id={`autodial-field-required-${index}`}
                          checked={field.required}
                          onChange={(e) =>
                            updateField(index, { ...field, required: e.target.checked })
                          }
                        />
                        <Label htmlFor={`autodial-field-required-${index}`}>
                          {t('autodial.bases.required')}
                        </Label>
                      </HStack>
                      <HStack gap="4" align="center">
                        <Checkbox
                          id={`autodial-field-phone-${index}`}
                          checked={field.is_phone || field.type === 'phone'}
                          disabled={field.type === 'phone'}
                          onChange={(e) =>
                            updateField(index, { ...field, is_phone: e.target.checked })
                          }
                        />
                        <Label htmlFor={`autodial-field-phone-${index}`}>
                          {t('autodial.bases.isPhone')}
                        </Label>
                      </HStack>
                    </HStack>

                    <TableRowActions>
                      <TableRowAction
                        title={t('common.moveUp')}
                        aria-label={t('common.moveUp')}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp />
                      </TableRowAction>
                      <TableRowAction
                        title={t('common.moveDown')}
                        aria-label={t('common.moveDown')}
                        disabled={index === draft.fields.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown />
                      </TableRowAction>
                      <TableRowAction
                        danger
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                        onClick={() => setFields(draft.fields.filter((_, i) => i !== index))}
                      >
                        <Trash2 />
                      </TableRowAction>
                    </TableRowActions>
                  </div>

                  {field.type === 'enum' && (
                    <VStack gap="4" className={cls.enumRow}>
                      <Label htmlFor={`autodial-field-enum-${index}`}>
                        {t('autodial.bases.enumValues')}
                      </Label>
                      <Input
                        id={`autodial-field-enum-${index}`}
                        value={(field.enum_values ?? []).join(', ')}
                        onChange={(e) =>
                          updateField(index, {
                            ...field,
                            enum_values: e.target.value
                              .split(',')
                              .map((v) => v.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </VStack>
                  )}
                </div>
              ))}

              {visibleErrors.fields && (
                <Text className={cls.error}>
                  {t(`autodial.bases.schemaError.${visibleErrors.fields}`)}
                </Text>
              )}

              <HStack gap="8">
                <Button
                  variant="outline"
                  onClick={() => setFields([...draft.fields, blankFieldDraft(draft.fields.length)])}
                >
                  <Plus size={16} />
                  {t('autodial.bases.addField')}
                </Button>
              </HStack>
            </VStack>
          </VStack>
        )}

        <DialogFooter className={cls.footer} data-testid="autodial-base-form-footer">
          <VStack gap="8" max align="end">
            {apiError && <Text className={cls.error}>{apiError}</Text>}
            <HStack gap="8" justify="end" max wrap="wrap" className={cls.footerActions}>
              <Button variant="outline" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button disabled={isSaving} onClick={() => void onSave()}>
                {isSaving ? <Loader2 size={16} className={cls.spinner} /> : null}
                {t('common.save')}
              </Button>
            </HStack>
          </VStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

BaseFormModal.displayName = 'BaseFormModal';
