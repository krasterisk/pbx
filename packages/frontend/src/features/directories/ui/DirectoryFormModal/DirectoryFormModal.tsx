import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DirectoryKeyNormalization, IDirectory } from '@krasterisk/shared';
import {
  Button,
  Input,
  Label,
  Select,
  Text,
  InfoTooltip,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { DirectoryLookupTest } from '../DirectoryLookupTest/DirectoryLookupTest';
import cls from './DirectoryFormModal.module.scss';

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

function toDraft(item: IDirectory | null | undefined, mode: 'create' | 'edit' | 'copy'): DirectoryDraft {
  if (!item || mode === 'create') return { ...EMPTY_DRAFT };
  const lookupFieldKey = item.fields?.find((field) => field.uid === item.lookup_field_uid)?.key ?? '';
  return {
    name: mode === 'copy' ? '' : item.name,
    description: item.description ?? '',
    keyNormalization: item.key_normalization,
    lookupFieldKey,
    fields: (item.fields ?? []).map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      position: field.position,
    })),
    records: (item.records ?? []).map((record) => ({
      match_kind: record.match_kind,
      priority: record.priority,
      values: toRecordValues(record.values),
      comment: record.comment,
    })),
  };
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
  const [referenceLocations, setReferenceLocations] = useState<string[]>([]);
  const fieldsBeforeDeleteRef = useRef<IDirectoryFieldDraft[] | null>(null);

  const source = directoryDetails ?? editingItem ?? null;

  useEffect(() => {
    if (!modalOpen) return;
    setDraft(toDraft(mode === 'create' ? null : source, mode));
    setReferenceLocations([]);
    fieldsBeforeDeleteRef.current = null;
  }, [modalOpen, mode, source]);

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
        fieldsBeforeDeleteRef.current = prev.fields;
      }
      const lookupStillExists = nextFields.some((field) => field.key === prev.lookupFieldKey);
      const lookupType = nextFields.find((field) => field.key === prev.lookupFieldKey)?.type;
      let records = remapRecords(prev.records, prev.fields, nextFields);
      if (lookupType && lookupType !== 'phone') {
        records = records.map((record) => (
          record.match_kind === 'asterisk_pattern'
            ? { ...record, match_kind: 'exact' as const }
            : record
        ));
      }
      return {
        ...prev,
        fields: nextFields,
        records,
        lookupFieldKey: lookupStillExists ? prev.lookupFieldKey : '',
      };
    });
  }, []);

  const handleLookupFieldKeyChange = useCallback((key: string) => {
    setDraft((prev) => ({ ...prev, lookupFieldKey: key }));
  }, []);

  const handleRecordsChange = useCallback((records: IDirectoryRecordDraft[]) => {
    setDraft((prev) => ({ ...prev, records }));
  }, []);

  const canSave = Boolean(
    draft.name.trim()
    && draft.lookupFieldKey
    && draft.fields.some((field) => field.key === draft.lookupFieldKey),
  );

  const handleSubmit = useCallback(async () => {
    if (!canSave) return;
    setReferenceLocations([]);

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
        match_kind: record.match_kind,
        priority: Number(record.priority) || 1,
        values: record.values,
        comment: record.comment?.trim() || undefined,
      })),
    };

    try {
      if (mode === 'edit' && editingItem) {
        await updateDirectory({ uid: editingItem.uid, data: payload }).unwrap();
      } else {
        await createDirectory(payload).unwrap();
      }
      handleClose();
    } catch (error) {
      const references = extractReferences(error);
      if (references.length) {
        setReferenceLocations(references.map((ref) => ref.location));
        if (fieldsBeforeDeleteRef.current) {
          setDraft((prev) => ({ ...prev, fields: fieldsBeforeDeleteRef.current ?? prev.fields }));
        }
        return;
      }
    }
  }, [canSave, draft, mode, editingItem, createDirectory, updateDirectory, handleClose]);

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

        <div className={cls.formBody}>
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

            <VStack gap="4" className={cls.field}>
              <HStack gap="4" align="center">
                <Label htmlFor="directory-normalization">{t('directories.keyNormalization', 'Key normalization')}</Label>
                <InfoTooltip text={t('directories.keyNormalizationHint', 'Digits keeps only numeric characters on exact lookup keys.')} />
              </HStack>
              <Select
                id="directory-normalization"
                value={draft.keyNormalization}
                onChange={(e) => setDraft((prev) => ({
                  ...prev,
                  keyNormalization: e.target.value as DirectoryKeyNormalization,
                }))}
              >
                <option value="none">{t('directories.normalizationNone', 'None')}</option>
                <option value="digits">{t('directories.normalizationDigits', 'Digits')}</option>
              </Select>
            </VStack>

            <DirectorySchemaEditor
              fields={draft.fields}
              lookupFieldKey={draft.lookupFieldKey}
              onFieldsChange={handleFieldsChange}
              onLookupFieldKeyChange={handleLookupFieldKeyChange}
              lockedKeys={lockedKeys}
            />

            <DirectoryRecordsEditor
              fields={draft.fields}
              lookupFieldKey={draft.lookupFieldKey}
              records={draft.records}
              onRecordsChange={handleRecordsChange}
            />

            {mode === 'edit' && editingItem && (
              <DirectoryLookupTest directoryUid={editingItem.uid} fieldUids={fieldUids} />
            )}
          </VStack>
        </div>

        <DialogFooter className={cls.footer}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

DirectoryFormModal.displayName = 'DirectoryFormModal';
