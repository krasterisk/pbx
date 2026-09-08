import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DirectoryKeyNormalization, IDirectory } from '@krasterisk/shared';
import {
  Button,
  Input,
  Label,
  Text,
  InfoTooltip,
  RadioCards,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useCreateDirectoryMutation,
  useGetDirectoryQuery,
  useUpdateDirectoryMutation,
} from '@/shared/api/endpoints/directoryApi';
import { directoriesActions } from '../../model/slice/directoriesSlice';
import {
  getDirectoriesEditingItem,
  getDirectoriesModalMode,
  getDirectoriesModalOpen,
} from '../../model/selectors/directoriesSelectors';
import { DirectorySchemaEditor, type IDirectoryFieldDraft } from '../DirectorySchemaEditor/DirectorySchemaEditor';
import { DirectoryRecordsEditor, type IDirectoryRecordDraft } from '../DirectoryRecordsEditor/DirectoryRecordsEditor';
import { DirectoryCsvPanel } from '../DirectoryCsvPanel/DirectoryCsvPanel';
import { DirectoryLookupTest } from '../DirectoryLookupTest/DirectoryLookupTest';
import { UsageTab } from '@/features/route-references/ui/UsageTab';
import {
  findDuplicateRecordIndexes,
  recordHasAsteriskPattern,
} from '../../model/directoryRecordLookup';
import cls from './DirectoryFormModal.module.scss';

type DirectoryTab = 'general' | 'fields' | 'records' | 'test' | 'usage';

interface DirectoryDraft {
  name: string;
  description: string;
  keyNormalization: DirectoryKeyNormalization;
  lookupFieldKey: string;
  fields: IDirectoryFieldDraft[];
  records: IDirectoryRecordDraft[];
}

interface DirectoryReference {
  location: string;
}

const EMPTY_DRAFT: DirectoryDraft = {
  name: '',
  description: '',
  keyNormalization: 'none',
  lookupFieldKey: '',
  fields: [],
  records: [],
};

function toRecordValues(values: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const next: Record<string, string | number | boolean> = {};
  if (!values) return next;
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      next[key] = value;
    } else if (value != null) {
      next[key] = String(value);
    }
  }
  return next;
}

function toRecordDrafts(item: IDirectory | null | undefined): IDirectoryRecordDraft[] {
  return (item?.records ?? []).map((record) => ({
    values: toRecordValues(record.values),
    comment: record.comment,
  }));
}

function toDraft(item: IDirectory | null | undefined, mode: 'create' | 'edit' | 'copy'): DirectoryDraft {
  if (!item || mode === 'create') return { ...EMPTY_DRAFT };
  const lookupFieldKey = item.fields?.find((field) => field.uid === item.lookup_field_uid)?.key ?? '';
  return {
    name: mode === 'copy' ? '' : item.name,
    description: item.description ?? '',
    keyNormalization: item.key_normalization,
    lookupFieldKey,
    fields: (item.fields ?? []).map((field) => ({
      rowId: `field-${field.uid}`,
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      position: field.position,
    })),
    records: toRecordDrafts(item),
  };
}

/** Stable shape used to tell an edited draft from the one that was loaded. */
function serializeDraft(draft: DirectoryDraft): string {
  return JSON.stringify({
    name: draft.name.trim(),
    description: draft.description.trim(),
    keyNormalization: draft.keyNormalization,
    lookupFieldKey: draft.lookupFieldKey,
    fields: draft.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
    })),
    records: draft.records.map((record) => ({
      values: record.values,
      comment: record.comment ?? '',
    })),
  });
}

function remapRecords(
  records: IDirectoryRecordDraft[],
  prevFields: IDirectoryFieldDraft[],
  nextFields: IDirectoryFieldDraft[],
): IDirectoryRecordDraft[] {
  if (prevFields.length === nextFields.length) {
    const renamed = prevFields.find((field, index) => field.key !== nextFields[index]?.key);
    if (!renamed) return records;
    const index = prevFields.findIndex((field) => field.key === renamed.key);
    const nextKey = nextFields[index]?.key;
    if (!nextKey) return records;
    return records.map((record) => {
      if (!(renamed.key in record.values)) return record;
      const values = { ...record.values };
      values[nextKey] = values[renamed.key];
      delete values[renamed.key];
      return { ...record, values };
    });
  }
  const nextKeys = new Set(nextFields.map((field) => field.key));
  const removed = prevFields.filter((field) => !nextKeys.has(field.key)).map((field) => field.key);
  if (!removed.length) return records;
  return records.map((record) => {
    const values = { ...record.values };
    for (const key of removed) delete values[key];
    return { ...record, values };
  });
}

function extractReferences(error: unknown): DirectoryReference[] {
  const data = (error as { data?: { references?: DirectoryReference[] } })?.data;
  return Array.isArray(data?.references) ? data.references.filter((ref) => typeof ref?.location === 'string') : [];
}

function extractMessage(error: unknown): string | null {
  const message = (error as { data?: { message?: unknown } })?.data?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.filter((item) => typeof item === 'string').join('. ');
  return null;
}

export const DirectoryFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const modalOpen = useAppSelector(getDirectoriesModalOpen);
  const mode = useAppSelector(getDirectoriesModalMode);
  const editingItem = useAppSelector(getDirectoriesEditingItem);

  const skipDetails = !modalOpen || mode === 'create' || !editingItem?.uid;
  const { data: directoryDetails } = useGetDirectoryQuery(editingItem?.uid ?? 0, { skip: skipDetails });

  const [createDirectory, { isLoading: isCreating }] = useCreateDirectoryMutation();
  const [updateDirectory, { isLoading: isUpdating }] = useUpdateDirectoryMutation();

  const [draft, setDraft] = useState<DirectoryDraft>(EMPTY_DRAFT);
  const [baseline, setBaseline] = useState<string>(() => serializeDraft(EMPTY_DRAFT));
  const [tab, setTab] = useState<DirectoryTab>('general');
  const [referenceLocations, setReferenceLocations] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const draftBeforeDeleteRef = useRef<Pick<DirectoryDraft, 'fields' | 'records' | 'lookupFieldKey'> | null>(null);
  const initializedKeyRef = useRef<string | null>(null);
  const awaitImportRef = useRef(false);

  const source = directoryDetails ?? editingItem ?? null;
  const savedUid = mode === 'edit' ? editingItem?.uid : undefined;

  useEffect(() => {
    if (!modalOpen) {
      initializedKeyRef.current = null;
      return;
    }
    const key = `${mode}:${editingItem?.uid ?? 'new'}:${directoryDetails ? 'full' : 'partial'}`;
    if (initializedKeyRef.current === key) return;
    initializedKeyRef.current = key;

    const next = toDraft(mode === 'create' ? null : source, mode);
    setDraft(next);
    setBaseline(serializeDraft(next));
    setReferenceLocations([]);
    setSaveError(null);
    draftBeforeDeleteRef.current = null;
  }, [modalOpen, mode, editingItem?.uid, directoryDetails, source]);

  useEffect(() => {
    if (!modalOpen) setTab('general');
  }, [modalOpen]);

  // A finished import only refreshes the records; the rest of the draft survives.
  useEffect(() => {
    if (!awaitImportRef.current || !directoryDetails) return;
    awaitImportRef.current = false;
    setDraft((prev) => {
      const next = { ...prev, records: toRecordDrafts(directoryDetails) };
      setBaseline(serializeDraft(next));
      return next;
    });
  }, [directoryDetails]);

  const lockedKeys = useMemo(() => {
    if (mode !== 'edit') return undefined;
    return new Set((source?.fields ?? []).map((field) => field.key));
  }, [mode, source]);

  const handleClose = useCallback(() => {
    dispatch(directoriesActions.closeModal());
  }, [dispatch]);

  const handleFieldsChange = useCallback((nextFields: IDirectoryFieldDraft[]) => {
    setDraft((prev) => {
      if (nextFields.length < prev.fields.length) {
        draftBeforeDeleteRef.current = {
          fields: prev.fields,
          records: prev.records,
          lookupFieldKey: prev.lookupFieldKey,
        };
      }
      const renamedLookupIndex = prev.fields.findIndex((field) => field.key === prev.lookupFieldKey);
      const lookupFieldKey = nextFields.some((field) => field.key === prev.lookupFieldKey)
        ? prev.lookupFieldKey
        : renamedLookupIndex >= 0 && prev.fields.length === nextFields.length
          ? nextFields[renamedLookupIndex]?.key ?? ''
          : '';
      return {
        ...prev,
        fields: nextFields,
        records: remapRecords(prev.records, prev.fields, nextFields),
        lookupFieldKey,
      };
    });
  }, []);

  const handleLookupFieldKeyChange = useCallback((key: string) => {
    setDraft((prev) => ({ ...prev, lookupFieldKey: key }));
  }, []);

  const handleRecordsChange = useCallback((records: IDirectoryRecordDraft[]) => {
    setDraft((prev) => ({ ...prev, records }));
  }, []);

  const handleImported = useCallback(() => {
    awaitImportRef.current = true;
  }, []);

  const isDirty = serializeDraft(draft) !== baseline;

  const blockingReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!draft.name.trim()) {
      reasons.push(t('directories.saveBlocked.name', 'Enter a directory name.'));
    }
    if (!draft.fields.length) {
      reasons.push(t('directories.saveBlocked.fields', 'Add at least one field.'));
    }
    if (!draft.lookupFieldKey || !draft.fields.some((field) => field.key === draft.lookupFieldKey)) {
      reasons.push(t('directories.saveBlocked.lookup', 'Pick the lookup field.'));
    }
    const lookupType = draft.fields.find((field) => field.key === draft.lookupFieldKey)?.type;
    if (
      lookupType
      && lookupType !== 'phone'
      && draft.records.some((record) => recordHasAsteriskPattern(record.values[draft.lookupFieldKey]))
    ) {
      reasons.push(t(
        'directories.saveBlocked.patternLookup',
        'Patterns (a value starting with _) are allowed only when the lookup field type is Phone.',
      ));
    }
    if (findDuplicateRecordIndexes(draft.records, draft.lookupFieldKey, draft.keyNormalization).size) {
      reasons.push(t(
        'directories.saveBlocked.duplicateLookup',
        'Each number or pattern can appear only once.',
      ));
    }
    return reasons;
  }, [draft.name, draft.fields, draft.lookupFieldKey, draft.records, draft.keyNormalization, t]);

  const canSave = blockingReasons.length === 0;

  const handleSubmit = useCallback(async () => {
    if (!canSave) return;
    setReferenceLocations([]);
    setSaveError(null);

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      lookupFieldKey: draft.lookupFieldKey,
      key_normalization: draft.keyNormalization,
      fields: draft.fields.map((field, index) => ({
        key: field.key,
        label: field.label || field.key,
        type: field.type,
        required: field.required,
        position: index,
      })),
      records: draft.records.map((record) => ({
        values: record.values,
        comment: record.comment?.trim() || undefined,
      })),
    };

    try {
      if (mode === 'edit' && editingItem) {
        await updateDirectory({ uid: editingItem.uid, data: payload }).unwrap();
        handleClose();
        return;
      }
      // Staying open in edit mode makes CSV import reachable right after creation.
      const created = await createDirectory(payload).unwrap();
      dispatch(directoriesActions.openEditModal(created));
      setTab('records');
    } catch (error) {
      const references = extractReferences(error);
      if (references.length) {
        setReferenceLocations(references.map((ref) => ref.location));
        if (draftBeforeDeleteRef.current) {
          const snapshot = draftBeforeDeleteRef.current;
          setDraft((prev) => ({
            ...prev,
            fields: snapshot.fields,
            records: snapshot.records,
            lookupFieldKey: snapshot.lookupFieldKey,
          }));
        }
        return;
      }
      setSaveError(extractMessage(error) ?? t('directories.saveError', 'Could not save the directory.'));
    }
  }, [
    canSave, draft, mode, editingItem, createDirectory, updateDirectory, handleClose, dispatch, t,
  ]);

  const title = mode === 'edit'
    ? t('directories.editTitle', 'Edit directory')
    : mode === 'copy'
      ? t('directories.copyTitle', 'Copy directory')
      : t('directories.createTitle', 'New directory');

  const fieldUids = (source?.fields ?? []).map((field) => field.uid);
  const isSaving = isCreating || isUpdating;

  if (!modalOpen) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent size="large">
        <DialogHeader className={cls.header}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div
          className={cls.formBody}
          data-testid="directory-form-body"
          data-viewport="360,768,1440"
          data-overflow="y"
        >
          <VStack gap="16" max>
            {referenceLocations.length > 0 && (
              <VStack gap="8" className={cls.referenceError} data-testid="directory-reference-error">
                <Text variant="error">
                  {t('directories.referenceError', 'This field is used in routes and cannot be deleted.')}
                </Text>
                {referenceLocations.map((location) => (
                  <Text key={location} variant="small">{location}</Text>
                ))}
              </VStack>
            )}

            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as DirectoryTab)}
              className={cls.tabs}
            >
              <TabsList aria-label={title}>
                <TabsTrigger value="general" data-testid="directory-tab-general">
                  {t('directories.tabs.general', 'General')}
                </TabsTrigger>
                <TabsTrigger value="fields" data-testid="directory-tab-fields">
                  {t('directories.tabs.fields', 'Fields')}
                </TabsTrigger>
                <TabsTrigger value="records" data-testid="directory-tab-records">
                  {t('directories.tabs.records', 'Records')}
                </TabsTrigger>
                {savedUid && (
                  <TabsTrigger value="test" data-testid="directory-tab-test">
                    {t('directories.tabs.test', 'Lookup test')}
                  </TabsTrigger>
                )}
                {savedUid && (
                  <TabsTrigger value="usage" data-testid="directory-tab-usage">
                    {t('references.tab', 'Где используется')}
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="general">
                <VStack gap="16" max>
                  <HStack className={cls.formGrid} max>
                    <VStack gap="4" className={cls.field}>
                      <Label htmlFor="directory-name">{t('directories.name', 'Name')} *</Label>
                      <Input
                        id="directory-name"
                        data-testid="directory-name"
                        value={draft.name}
                        onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                        autoFocus
                      />
                    </VStack>
                    <VStack gap="4" className={cls.field}>
                      <Label htmlFor="directory-description">{t('directories.description', 'Description')}</Label>
                      <Input
                        id="directory-description"
                        value={draft.description}
                        onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                      />
                    </VStack>
                  </HStack>

                  <VStack gap="8" max className={cls.normalization} data-testid="directory-normalization">
                    <HStack gap="4" align="center">
                      <Text variant="h4">{t('directories.keyNormalization', 'Key comparison')}</Text>
                      <InfoTooltip text={t('directories.keyNormalizationHint', 'Applies to exact numbers only. Patterns that start with _ are not rewritten.')} />
                    </HStack>
                    <RadioCards
                      ariaLabel={t('directories.keyNormalization', 'Key comparison')}
                      value={draft.keyNormalization}
                      onChange={(value) => setDraft((prev) => ({
                        ...prev,
                        keyNormalization: value as DirectoryKeyNormalization,
                      }))}
                      options={[
                        {
                          value: 'none',
                          label: t('directories.normalizationNone', 'As written'),
                          description: t(
                            'directories.normalizationNoneHint',
                            '+79001234567 and 79001234567 stay different keys.',
                          ),
                        },
                        {
                          value: 'digits',
                          label: t('directories.normalizationDigits', 'Digits only'),
                          description: t(
                            'directories.normalizationDigitsHint',
                            '+7 (900) 123-45-67 and 79001234567 match. 8-900 stays 8900.',
                          ),
                        },
                        {
                          value: 'ru_8_to_7',
                          label: t('directories.normalizationRu8', 'Digits and 8 to 7'),
                          description: t(
                            'directories.normalizationRu8Hint',
                            '8-900-123-45-67 and +7 (900) 123-45-67 both become 79001234567.',
                          ),
                        },
                      ]}
                    />
                  </VStack>
                </VStack>
              </TabsContent>

              <TabsContent value="fields">
                <DirectorySchemaEditor
                  fields={draft.fields}
                  lookupFieldKey={draft.lookupFieldKey}
                  onFieldsChange={handleFieldsChange}
                  onLookupFieldKeyChange={handleLookupFieldKeyChange}
                  lockedKeys={lockedKeys}
                />
              </TabsContent>

              <TabsContent value="records">
                <VStack gap="16" max>
                  <DirectoryCsvPanel
                    directoryUid={savedUid}
                    directoryName={draft.name}
                    fields={draft.fields}
                    recordCount={draft.records.length}
                    isDirty={isDirty}
                    onImported={handleImported}
                  />
                  <DirectoryRecordsEditor
                    fields={draft.fields}
                    lookupFieldKey={draft.lookupFieldKey}
                    keyNormalization={draft.keyNormalization}
                    records={draft.records}
                    onRecordsChange={handleRecordsChange}
                  />
                </VStack>
              </TabsContent>

              {savedUid && (
                <TabsContent value="test">
                  <DirectoryLookupTest directoryUid={savedUid} fieldUids={fieldUids} />
                </TabsContent>
              )}

              {savedUid && (
                <TabsContent value="usage">
                  <UsageTab kind="directory" uid={savedUid} />
                </TabsContent>
              )}
            </Tabs>
          </VStack>
        </div>

        <DialogFooter className={cls.footer} data-testid="directory-form-footer">
          <VStack gap="8" max>
            {!canSave && (
              <VStack gap="4" max data-testid="directory-save-blocked">
                <Text variant="muted">{t('directories.saveBlocked.title', 'Save is unavailable')}</Text>
                {blockingReasons.map((reason) => (
                  <Text key={reason} variant="small">{reason}</Text>
                ))}
              </VStack>
            )}
            {saveError && (
              <Text variant="error" data-testid="directory-save-error">{saveError}</Text>
            )}
            <HStack gap="8" justify="end" max className={cls.footerActions}>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                data-testid="directory-save"
                onClick={() => void handleSubmit()}
                disabled={!canSave || isSaving}
              >
                {isSaving ? t('common.loading') : t('common.save')}
              </Button>
            </HStack>
          </VStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

DirectoryFormModal.displayName = 'DirectoryFormModal';
