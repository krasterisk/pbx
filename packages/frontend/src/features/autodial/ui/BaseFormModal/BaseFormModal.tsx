import { Switch, TagInput } from '@/shared/ui';
import { ModalBody } from '@/shared/ui';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  AUTODIAL_DEDUP_POLICIES,
  AUTODIAL_PHONE_NORMALIZATIONS,
} from '@krasterisk/shared';
import { Button, Dialog, FormDialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, TableRowAction, TableRowActions, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useCreateAutodialBaseMutation,
  useGetAutodialBaseQuery,
  useUpdateAutodialBaseMutation,
  useGetAutodialFieldUsageQuery,
  usePreviewAutodialSchemaMutation,
} from '@/shared/api/endpoints/autodialApi';
import type { AutodialSchemaMigrationRequest, IAutodialSchemaPreview } from '@krasterisk/shared';
import { SchemaMigrationDialog } from './SchemaMigrationDialog';
import {
  autodialPageActions,
  selectAutodialSelectedBaseUid,
  selectAutodialBaseModalMode,
  selectAutodialBaseModalOpen,
} from '../../model/slice/autodialPageSlice';
import {
  AUTODIAL_FIELD_TYPE_ORDER,
  baseDraftToPayload,
  baseTemplateFields,
  type AutodialBaseTemplate,
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
import { autodialErrorKey } from '../../lib/mutationError';

export const BaseFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectAutodialBaseModalOpen);
  const mode = useAppSelector(selectAutodialBaseModalMode);
  const activeUid = useAppSelector(selectAutodialSelectedBaseUid);
  const editUid = mode === 'edit' ? activeUid : null;

  const { currentData: base, isFetching, isError, refetch } = useGetAutodialBaseQuery(editUid as number, {
    skip: !isOpen || editUid === null,
  });
  const [createBase, { isLoading: isCreating }] = useCreateAutodialBaseMutation();
  const [updateBase, { isLoading: isUpdating }] = useUpdateAutodialBaseMutation();
  const { currentData: usage } = useGetAutodialFieldUsageQuery(editUid ?? 0, { skip: !isOpen || editUid === null });
  const [previewSchema, { isLoading: isPreviewing }] = usePreviewAutodialSchemaMutation();
  const [migration, setMigration] = useState<{ request: AutodialSchemaMigrationRequest; preview: IAutodialSchemaPreview } | null>(null);
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [omitOptional, setOmitOptional] = useState(false);
  const baseline = useRef('');

  const [draft, setDraft] = useState<AutodialBaseDraft>(emptyBaseDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const sessionKey = String(editUid ?? 'new');

  useEffect(() => {
    if (!isOpen) { setHydratedKey(null); return; }
    if (hydratedKey === sessionKey || (editUid !== null && !base)) return;
    setShowErrors(false);
    setApiError(null);
    const initial = editUid !== null && base ? baseToDraft(base) : emptyBaseDraft();
    setDraft(initial); baseline.current = JSON.stringify(initial); setDefaults({}); setOmitOptional(false); setMigration(null);
    setHydratedKey(sessionKey);
  }, [isOpen, editUid, base, sessionKey, hydratedKey]);

  const errors = useMemo(() => validateBaseDraft(draft), [draft]);
  const visibleErrors = showErrors ? errors : {};
  const isSaving = isCreating || isUpdating || isPreviewing;
  const isReady = hydratedKey === sessionKey && !isError;

  const close = () => {
    if ((JSON.stringify(draft) !== baseline.current || omitOptional || Object.values(defaults).some(Boolean)) && !window.confirm(t('autodial.workspace.discard'))) return;
    dispatch(autodialPageActions.closeBaseModal());
  };

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
    if (!isReady || isSaving) return;
    if (hasBaseErrors(errors)) {
      setShowErrors(true);
      return;
    }
    setApiError(null);
    const payload = baseDraftToPayload(draft);
    try {
      if (editUid !== null) {
        await updateBase({ uid: editUid, data: payload }).unwrap();
      } else {
        const created = await createBase(payload).unwrap();
        dispatch(autodialPageActions.selectBase(created.uid));
      }
      dispatch(autodialPageActions.closeBaseModal());
    } catch (error) {
      setApiError(t(autodialErrorKey(error, 'autodial.bases.saveFailed')));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && close()}>
      <FormDialogContent size="large" className={cls.dialog} data-testid="autodial-base-form-modal" aria-describedby={undefined}>
        <DialogHeader className={cls.header}>
          <DialogTitle>
            {editUid !== null ? t('autodial.bases.editTitle') : t('autodial.bases.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {isError ? (
          <QueryErrorState message={t('autodial.common.loadFailed')} onRetry={() => void refetch()} retryLabel={t('autodial.common.retry')} />
        ) : !isReady || (isFetching && editUid !== null && !base) ? (
          <HStack justify="center" align="center" className={cls.body}>
            <Loader2 size={24} className={cls.spinner} />
          </HStack>
        ) : (
          <ModalBody


            className={cls.body}
            data-testid="autodial-base-form-body"
            data-viewport="360,768,1440"
            data-overflow="y"
          >
            {editUid === null && <VStack gap="4" align="stretch">
              <Label htmlFor="autodial-base-template">{t('autodial.workspace.baseTemplate')}</Label>
              <Select id="autodial-base-template" value="" onChange={(event) => {
                const template = event.target.value as AutodialBaseTemplate;
                if (template && (JSON.stringify(draft.fields) === JSON.stringify(emptyBaseDraft().fields) || window.confirm(t('autodial.workspace.replaceTemplateFields'))))
                  setDraft({ ...draft, fields: baseTemplateFields(template) });
              }}><option value="">{t('autodial.workspace.chooseTemplate')}</option>
                {(['collection', 'appointment', 'survey'] as const).map((key) => <option key={key} value={key}>{t(`autodial.workspace.templates.${key}`)}</option>)}
              </Select>
            </VStack>}
            <div className={cls.grid}>
              <VStack align="stretch" gap="4">
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

              <VStack align="stretch" gap="4">
                <Label htmlFor="autodial-base-description">
                  {t('autodial.bases.description')}
                </Label>
                <Input
                  id="autodial-base-description"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </VStack>

              <VStack align="stretch" gap="4">
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

              <VStack align="stretch" gap="4">
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

            <VStack align="stretch" gap="8" max>
              <Text className={cls.sectionTitle}>{t('autodial.bases.schema')}</Text>
              <Text className={cls.hint}>{t('autodial.bases.schemaHint')}</Text>

              {draft.fields.map((field, index) => (
                <div key={field.uid ?? `new-${index}`} className={cls.fieldRow}>
                  <div className={cls.fieldGrid}>
                    <VStack align="stretch" gap="4">
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

                    <VStack align="stretch" gap="4">
                      <Label htmlFor={`autodial-field-label-${index}`}>
                        {t('autodial.bases.fieldLabel')}
                      </Label>
                      <Input
                        id={`autodial-field-label-${index}`}
                        value={field.label}
                        onChange={(e) => updateField(index, { ...field, label: e.target.value })}
                      />
                    </VStack>

                    <VStack align="stretch" gap="4">
                      <Label htmlFor={`autodial-field-type-${index}`}>
                        {t('autodial.bases.fieldType')}
                      </Label>
                      <Select
                        id={`autodial-field-type-${index}`}
                        value={field.type}
                        disabled={Boolean(field.uid && base?.fields.find((old) => old.uid === field.uid)?.is_phone)}
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

                    <VStack align="stretch" gap="4">
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
                        <Switch
                          id={`autodial-field-required-${index}`}
                          checked={field.required}
                          onCheckedChange={(checked) => updateField(index, { ...field, required: checked })
                          }
                        />
                        <Label htmlFor={`autodial-field-required-${index}`}>
                          {t('autodial.bases.required')}
                        </Label>
                      </HStack>
                      <HStack gap="4" align="center">
                        <Switch
                          id={`autodial-field-phone-${index}`}
                          checked={field.is_phone || field.type === 'phone'}
                          disabled={field.type === 'phone'}
                          onCheckedChange={(checked) => updateField(index, { ...field, is_phone: checked })
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
                        disabled={Boolean(field.uid && base?.fields.find((old) => old.uid === field.uid)?.is_phone)}
                        onClick={() => setFields(draft.fields.filter((_, i) => i !== index))}
                      >
                        <Trash2 />
                      </TableRowAction>
                    </TableRowActions>
                  </div>

                  {field.uid && <Text variant="muted">{t('autodial.workspace.fieldUsage')}: {usage?.fields.find((item) => item.uid === field.uid)?.used_by.map((item) => item.name).join(', ') || t('autodial.workspace.notUsed')}</Text>}
                  {field.type === 'money' && <VStack gap="4"><Label htmlFor={`field-currency-${index}`}>{t('autodial.workspace.currency')}</Label>
                    <Select id={`field-currency-${index}`} value={field.format?.currency ?? 'RUB'} options={['RUB', 'USD', 'EUR'].map((value) => ({ value, label: value }))}
                      onChange={(event) => updateField(index, { ...field, format: { ...field.format, currency: event.target.value as 'RUB' | 'USD' | 'EUR' } })} /></VStack>}
                  {field.type === 'date' && <VStack gap="4"><Label htmlFor={`field-date-format-${index}`}>{t('autodial.workspace.dateInput')}</Label>
                    <Select id={`field-date-format-${index}`} value={field.format?.date_input ?? 'auto'} options={['auto', 'ru', 'iso'].map((value) => ({ value, label: t(`autodial.workspace.dateFormats.${value}`) }))}
                      onChange={(event) => updateField(index, { ...field, format: { ...field.format, date_input: event.target.value as 'auto' | 'ru' | 'iso' } })} /></VStack>}
                  {editUid !== null && !field.is_phone && field.type !== 'phone' && <VStack gap="4">
                    <Label htmlFor={`field-default-${index}`}>{t('autodial.workspace.migrationDefault')}</Label>
                    <Input id={`field-default-${index}`} value={defaults[field.key] ?? ''} onChange={(event) => setDefaults({ ...defaults, [field.key]: event.target.value })} />
                  </VStack>}

                  {field.type === 'enum' && (
                    <VStack align="stretch" gap="4" className={cls.enumRow}>
                      <Label htmlFor={`autodial-field-enum-${index}`}>
                        {t('autodial.bases.enumValues')}
                      </Label>
                      <TagInput
                        aria-label={t('autodial.bases.enumValues')}
                        value={field.enum_values ?? []}
                        onChange={(enum_values) =>
                          updateField(index, {
                            ...field,
                            enum_values,
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
          </ModalBody>
        )}

        <DialogFooter className={cls.footer} data-testid="autodial-base-form-footer">
          <VStack gap="8" max align="end">
            {apiError && <Text className={cls.error}>{apiError}</Text>}
            {editUid !== null && <HStack gap="8" align="center"><Switch id="schema-archive-optional" checked={omitOptional} onCheckedChange={setOmitOptional} />
              <Label htmlFor="schema-archive-optional">{t('autodial.workspace.archiveInvalidOptional')}</Label></HStack>}
            <HStack gap="8" justify="end" max wrap="wrap" className={cls.footerActions}>
              <Button variant="outline" disabled={isSaving} onClick={close}>
                {t('common.cancel')}
              </Button>
              {editUid !== null && <Button variant="outline" disabled={isSaving || !isReady} onClick={async () => {
                if (hasBaseErrors(errors)) { setShowErrors(true); return; }
                setApiError(null);
                const request: AutodialSchemaMigrationRequest = { expected_revision: draft.revision ?? 0,
                  fields: baseDraftToPayload(draft).fields, invalid_optional_policy: omitOptional ? 'archive_omit' : 'reject',
                  defaults: Object.fromEntries(Object.entries(defaults).filter(([key, value]) => value !== '' && draft.fields.some((field) => field.key === key))),
                };
                try { const preview = await previewSchema({ uid: editUid, data: request }).unwrap(); setMigration({ request, preview }); }
                catch (cause) { setApiError(t(autodialErrorKey(cause, 'autodial.bases.saveFailed'))); }
              }}>{t('autodial.workspace.schemaPreview')}</Button>}
              <Button disabled={isSaving || !isReady} onClick={() => void onSave()}>
                {isSaving ? <Loader2 size={16} className={cls.spinner} /> : null}
                {t('common.save')}
              </Button>
            </HStack>
          </VStack>
        </DialogFooter>
        {editUid !== null && migration && <SchemaMigrationDialog uid={editUid} request={migration.request} preview={migration.preview}
          onClose={() => setMigration(null)} onApplied={() => { setMigration(null); dispatch(autodialPageActions.closeBaseModal()); }} />}
      </FormDialogContent>
    </Dialog>
  );
});

BaseFormModal.displayName = 'BaseFormModal';
