import { Switch } from '@/shared/ui';
import { ModalBody } from '@/shared/ui';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, Upload } from 'lucide-react';
import type { AutodialDedupPolicy, AutodialImportSource, AutodialFieldType, IAutodialColumnMap } from '@krasterisk/shared';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  FormDialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useGetAutodialBaseQuery,
  useGetAutodialImportProfilesQuery,
  useImportAutodialFileMutation,
  usePreviewAutodialImportMutation,
  useUpsertAutodialImportProfileMutation,
  useValidateAutodialImportMutation,
  useDownloadAutodialRejectedMutation,
  useUpdateAutodialBaseMutation,
  type AutodialImportValidation,
  type AutodialImportPreview,
  type AutodialImportResult,
} from '@/shared/api/endpoints/autodialApi';
import {
  autodialPageActions,
  selectAutodialImportOpen,
} from '../../model/slice/autodialPageSlice';
import { buildAutoColumnMap, SPECIAL_IMPORT_TARGETS } from '../../model/importMapping';
import cls from './ImportWizard.module.scss';
import { autodialErrorKey } from '../../lib/mutationError';
import { downloadBlob } from '@/shared/lib/csv';
import { baseDraftToPayload, baseToDraft, AUTODIAL_FIELD_KEY_PATTERN, suggestFieldKey, suggestVarName } from '../../model/baseDraft';

type Step = 'upload' | 'map' | 'check' | 'done';

interface ImportWizardProps {
  baseUid: number;
}

/** base64 without the data: prefix — the API takes the raw payload. */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

export const ImportWizard = memo(({ baseUid }: ImportWizardProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectAutodialImportOpen);

  const { currentData: base } = useGetAutodialBaseQuery(baseUid, { skip: !isOpen });
  const { currentData: profiles } = useGetAutodialImportProfilesQuery(baseUid, { skip: !isOpen });
  const [preview, { isLoading: isPreviewing }] = usePreviewAutodialImportMutation();
  const [runImport, { isLoading: isImporting }] = useImportAutodialFileMutation();
  const [saveProfile, { isLoading: isSavingProfile }] = useUpsertAutodialImportProfileMutation();
  const [validate, { isLoading: isValidating }] = useValidateAutodialImportMutation();
  const [downloadRejected, { isLoading: isDownloading }] = useDownloadAutodialRejectedMutation();
  const [updateBase, { isLoading: isCreatingField }] = useUpdateAutodialBaseMutation();
  const [newField, setNewField] = useState<{ column: string; index: number; key: string; label: string; type: AutodialFieldType } | null>(null);
  const [validation, setValidation] = useState<AutodialImportValidation | null>(null);
  const [validationKey, setValidationKey] = useState('');

  const [step, setStep] = useState<Step>('upload');
  const [filename, setFilename] = useState('');
  const [source, setSource] = useState<AutodialImportSource>('csv');
  const [content, setContent] = useState('');
  const [delimiter, setDelimiter] = useState(';');
  const [hasHeader, setHasHeader] = useState(true);
  const [replace, setReplace] = useState(false);
  const [omitInvalidOptional, setOmitInvalidOptional] = useState(false);
  const [previewData, setPreviewData] = useState<AutodialImportPreview | null>(null);
  const [columnMap, setColumnMap] = useState<IAutodialColumnMap[]>([]);
  const [profileName, setProfileName] = useState('');
  const [result, setResult] = useState<AutodialImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileUid, setProfileUid] = useState<number | undefined>();
  const [dedup, setDedup] = useState<AutodialDedupPolicy | undefined>();
  const [isReading, setIsReading] = useState(false);
  const generation = useRef(0);
  const isBusy = isReading || isPreviewing || isImporting || isSavingProfile || isValidating || isDownloading || isCreatingField;

  useEffect(() => {
    generation.current += 1;
    if (isOpen) return () => { generation.current += 1; };
    setStep('upload');
    setFilename('');
    setContent('');
    setPreviewData(null);
    setValidation(null); setValidationKey('');
    setNewField(null);
    setColumnMap([]);
    setResult(null);
    setError(null);
    setProfileName('');
    setReplace(false);
    setOmitInvalidOptional(false);
    setProfileUid(undefined);
    setDedup(undefined);
    setIsReading(false);
    return () => { generation.current += 1; };
  }, [isOpen, baseUid]);

  const close = () => {
    if (content && step !== 'done' && !window.confirm(t('autodial.workspace.discard'))) return;
    dispatch(autodialPageActions.closeImport());
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|txt|xlsx)$/i.test(file.name) || file.size > 20 * 1024 * 1024) {
      setError(t('autodial.import.invalidFile'));
      return;
    }
    const request = ++generation.current;
    setIsReading(true);
    setError(null);
    setFilename(file.name);
    const isXlsx = /\.xlsx$/i.test(file.name);
    setSource(isXlsx ? 'xlsx' : 'csv');
    try {
      const base64 = await readAsBase64(file);
      if (request !== generation.current) return;
      setContent(base64);
      const data = await preview({
        baseUid,
        source: isXlsx ? 'xlsx' : 'csv',
        content_base64: base64,
        delimiter,
        has_header: hasHeader,
      }).unwrap();
      if (request !== generation.current) return;
      setPreviewData(data);
      setDelimiter(data.delimiter || delimiter);
      setColumnMap(buildAutoColumnMap(data.headers, base?.fields ?? []));
      setStep('map');
    } catch {
      if (request === generation.current) setError(t('autodial.import.previewFailed'));
    } finally {
      if (request === generation.current) setIsReading(false);
    }
  };

  const applyProfile = async (uid: number) => {
    const profile = profiles?.find((p) => p.uid === uid);
    if (!profile) return;
    const request = ++generation.current;
    setError(null);
    try {
      const data = await preview({
        baseUid, source, content_base64: content,
        delimiter: profile.delimiter || delimiter, has_header: profile.has_header,
      }).unwrap();
      if (request !== generation.current) return;
      setPreviewData(data);
      setColumnMap(profile.column_map ?? []);
      setDelimiter(profile.delimiter || delimiter);
      setHasHeader(profile.has_header);
      setProfileUid(uid);
      setDedup(profile.dedup_policy);
    } catch {
      if (request === generation.current) {
        setPreviewData(null);
        setStep('upload');
        setError(t('autodial.import.previewFailed'));
      }
    }
  };

  const matchesColumn = (mapping: IAutodialColumnMap, column: string, index: number) =>
    mapping.column_index !== undefined ? mapping.column_index === index : mapping.column === column;
  const setTarget = (column: string, index: number, field_key: string) => {
    setColumnMap((prev) => {
      const previous = prev.find((mapping) => matchesColumn(mapping, column, index));
      const without = prev.filter((mapping) => !matchesColumn(mapping, column, index));
      return field_key ? [...without, { ...previous, column, column_index: index, field_key }] : without;
    });
  };

  const targetFor = (column: string, index: number) =>
    columnMap.find((mapping) => matchesColumn(mapping, column, index))?.field_key ?? '';

  const uploadArgs = () => ({ baseUid, filename, source, content_base64: content, column_map: columnMap,
    delimiter, has_header: hasHeader, replace, expected_revision: previewData?.base_revision,
    profile_uid: profileUid, dedup_policy: dedup, invalid_optional_policy: omitInvalidOptional ? 'omit' as const : 'reject' as const });
  const currentValidation = validation && validationKey === JSON.stringify(uploadArgs());
  const onValidate = async () => {
    if (isBusy || !previewData) return; setError(null);
    const request = generation.current, args = uploadArgs();
    try {
      const data = await validate(args).unwrap();
      if (request !== generation.current) return;
      setValidation(data); setValidationKey(JSON.stringify(args)); setStep('check');
    } catch (cause) { if (request === generation.current) setError(t(autodialErrorKey(cause, 'autodial.import.importFailed'))); }
  };

  const onImport = async () => {
    if (isBusy || !previewData) return;
    if (!currentValidation || !validation.ready) { setError(t('autodial.workspace.checkImportAgain')); return; }
    setError(null);
    if (columnMap.every((m) => m.field_key !== '__phone' && !base?.fields.some(
      (field) => field.key === m.field_key && (field.is_phone || field.type === 'phone'),
    ))) {
      setError(t('autodial.import.phoneColumnRequired'));
      return;
    }
    if (replace && !window.confirm(t('autodial.import.confirmReplace', { name: base?.name ?? '', count: base?.contact_count ?? 0 }))) return;
    const request = generation.current;
    try {
      const res = await runImport(uploadArgs()).unwrap();
      if (request !== generation.current) return;
      setResult(res);
      setStep('done');
    } catch (error) {
      if (request === generation.current) setError(t(autodialErrorKey(error, 'autodial.import.importFailed')));
    }
  };

  const onDownloadRejected = async () => {
    setError(null);
    try {
      const blob = await downloadRejected(uploadArgs()).unwrap();
      downloadBlob(blob, 'autodial-rejected.xlsx');
    } catch (cause) { setError(t(autodialErrorKey(cause, 'autodial.import.importFailed'))); }
  };

  const onSaveProfile = async () => {
    if (!profileName.trim() || isBusy) return;
    setError(null);
    try {
      await saveProfile({
        baseUid,
        data: {
          name: profileName.trim(),
          source,
          delimiter,
          has_header: hasHeader,
          column_map: columnMap,
          dedup_policy: dedup ?? base?.dedup_policy,
        },
      }).unwrap();
      setProfileName('');
    } catch {
      setError(t('autodial.import.saveProfileFailed'));
    }
  };

  const onCreateField = async () => {
    if (!base || !newField || !AUTODIAL_FIELD_KEY_PATTERN.test(newField.key) || !newField.label.trim()
      || base.fields?.some((field) => field.key === newField.key) || isBusy) return;
    setError(null);
    try {
      const payload = baseDraftToPayload(baseToDraft(base));
      const updated = await updateBase({ uid: baseUid, data: { ...payload, fields: [...(payload.fields ?? []), {
        key: newField.key, label: newField.label.trim(), type: newField.type, required: false, is_phone: false,
        var_name: suggestVarName(newField.key), position: base.fields?.length ?? 0,
      }] } }).unwrap();
      setTarget(newField.column, newField.index, newField.key);
      setPreviewData((previous) => previous ? { ...previous, base_revision: updated.revision } : previous);
      setValidation(null); setValidationKey(''); setNewField(null);
    } catch (cause) { setError(t(autodialErrorKey(cause, 'autodial.bases.saveFailed'))); }
  };

  const fieldTargets = [
    ...SPECIAL_IMPORT_TARGETS.map((key) => ({
      value: key,
      label: t(`autodial.import.special.${key}`),
    })),
    ...(base?.fields ?? []).map((field) => ({
      value: field.key,
      label: field.label || field.key,
    })),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isBusy && close()}>
      <FormDialogContent size="large" className={cls.dialog} data-testid="autodial-import-wizard" aria-describedby={undefined}>
        <DialogHeader className={cls.header}>
          <DialogTitle>{t('autodial.import.title')}</DialogTitle>
        </DialogHeader>

        <ModalBody


          className={cls.body}
          data-testid="autodial-import-body"
          data-viewport="360,768,1440"
          data-overflow="y"
        >
          {step === 'upload' && (
            <VStack align="stretch" gap="12" max>
              <Text className={cls.hint}>{t('autodial.import.uploadHint')}</Text>
              <HStack gap="12" align="end" wrap="wrap">
                <VStack align="stretch" gap="4">
                  <Label htmlFor="autodial-import-file">{t('autodial.import.file')}</Label>
                  <Input
                    id="autodial-import-file"
                    type="file"
                    accept=".csv,.txt,.xlsx"
                    disabled={isBusy}
                    onChange={(e) => void onFile(e.target.files?.[0])}
                  />
                </VStack>
                <VStack align="stretch" gap="4">
                  <Label htmlFor="autodial-import-delimiter">
                    {t('autodial.import.delimiter')}
                  </Label>
                  <Input
                    id="autodial-import-delimiter"
                    className={cls.narrow}
                    value={delimiter}
                    maxLength={1}
                    disabled={isBusy}
                    onChange={(e) => setDelimiter(e.target.value)}
                  />
                </VStack>
                <HStack gap="4" align="center" className={cls.flag}>
                  <Switch
                    id="autodial-import-header"
                    checked={hasHeader}
                    disabled={isBusy}
                    onCheckedChange={(checked) => setHasHeader(checked)}
                  />
                  <Label htmlFor="autodial-import-header">{t('autodial.import.hasHeader')}</Label>
                </HStack>
              </HStack>
              {isPreviewing && <Loader2 size={18} className={cls.spinner} />}
            </VStack>
          )}

          {step === 'map' && previewData && (
            <VStack align="stretch" gap="16" max>
              <HStack gap="12" align="end" wrap="wrap">
                <Badge variant="outline">
                  {t('autodial.import.rowsFound', { count: previewData.total_rows })}
                </Badge>
                {(profiles ?? []).length > 0 && (
                  <VStack align="stretch" gap="4">
                    <Label htmlFor="autodial-import-profile">
                      {t('autodial.import.profile')}
                    </Label>
                    <Select
                      id="autodial-import-profile"
                      defaultValue=""
                      disabled={isBusy}
                      onChange={(e) => { if (e.target.value) void applyProfile(Number(e.target.value)); }}
                    >
                      <option value="">{t('autodial.import.profilePlaceholder')}</option>
                      {(profiles ?? []).map((profile) => (
                        <option key={profile.uid} value={profile.uid}>
                          {profile.name}
                        </option>
                      ))}
                    </Select>
                  </VStack>
                )}
                <HStack gap="4" align="center" className={cls.flag}>
                  <Checkbox
                    id="autodial-import-replace"
                    checked={replace}
                    disabled={isBusy}
                    onChange={(e) => setReplace(e.target.checked)}
                  />
                  <Label htmlFor="autodial-import-replace">{t('autodial.import.replace')}</Label>
                </HStack>
                <HStack gap="4" align="center" className={cls.flag}>
                  <Checkbox id="autodial-import-optional" checked={omitInvalidOptional}
                    disabled={isBusy} onChange={(event) => setOmitInvalidOptional(event.target.checked)} />
                  <Label htmlFor="autodial-import-optional">{t('autodial.import.omitInvalidOptional')}</Label>
                </HStack>
              </HStack>

              <div className={cls.tableScroll}>
                <Table showSearch={false} showExport={false}>
                  <TableHeader>
                    <TableRow>
                      {previewData.headers.map((header, index) => (
                        <TableHead key={`${header}-${index}`}>
                          <VStack gap="4" align="start">
                            <Text as="span" className={cls.headerName}>
                              {header || t('autodial.import.columnN', { n: index + 1 })}
                            </Text>
                            <Select
                              aria-label={t('autodial.import.mapTo', { column: header })}
                              value={targetFor(header, index)}
                              disabled={isBusy}
                              onChange={(e) => setTarget(header, index, e.target.value)}
                            >
                              <option value="">{t('autodial.import.skip')}</option>
                              {fieldTargets.map((target) => (
                                <option key={target.value} value={target.value}>
                                  {target.label}
                                </option>
                              ))}
                            </Select>
                            <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => setNewField({ column: header, index,
                              key: suggestFieldKey(header, (base?.fields?.length ?? 0) + index), label: header, type: 'string' })}>
                              {t('autodial.workspace.createColumnField')}
                            </Button>
                          </VStack>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.sample_rows.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {previewData.headers.map((_, colIndex) => (
                          <TableCell key={colIndex} className={cls.sampleCell}>
                            {row[colIndex] ?? ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <HStack gap="8" align="end" wrap="wrap">
                <VStack align="stretch" gap="4">
                  <Label htmlFor="autodial-import-profile-name">
                    {t('autodial.import.saveProfileAs')}
                  </Label>
                  <Input
                    id="autodial-import-profile-name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                </VStack>
                <Button
                  variant="outline"
                  disabled={!profileName.trim() || isBusy}
                  onClick={() => void onSaveProfile()}
                >
                  <Save size={16} />
                  {t('common.save')}
                </Button>
              </HStack>
            </VStack>
          )}

          {step === 'check' && validation && (
            <VStack align="stretch" gap="12" max>
              <Text>{t('autodial.workspace.importCheckSummary', { total: validation.total_rows, valid: validation.valid, skipped: validation.skipped })}</Text>
              <Text variant="muted">{t('autodial.workspace.importCheckUnchanged')}</Text>
              {replace && <Text>{t('autodial.import.confirmReplace', { name: base?.name ?? '', count: base?.contact_count ?? 0 })}</Text>}
              {!currentValidation && <Text role="alert">{t('autodial.workspace.checkImportAgain')}</Text>}
              {validation.rejected_rows.slice(0, 50).map((row, index) => (
                <Text key={index}>{t('autodial.import.errorRow', { row: row.row })}: {row.message}</Text>
              ))}
              {validation.warnings.slice(0, 50).map((warning, index) => (
                <Text key={`warning-${index}`} variant="muted">{t('autodial.import.optionalWarning', { ...warning })}</Text>
              ))}
              {validation.rejected_rows.length > 0 && <Button variant="outline" disabled={isBusy || !currentValidation}
                onClick={() => void onDownloadRejected()}>{t('autodial.workspace.downloadRejected')}</Button>}
            </VStack>
          )}

          {step === 'done' && result && (
            <VStack align="stretch" gap="12" max>
              <HStack gap="12" wrap="wrap">
                <Badge>{t('autodial.import.imported', { count: result.imported })}</Badge>
                <Badge variant="secondary">
                  {t('autodial.import.skipped', { count: result.skipped })}
                </Badge>
              </HStack>
              {result.errors.length > 0 && (
                <VStack align="stretch" gap="4" max className={cls.errorList}>
                  <Text className={cls.sectionTitle}>{t('autodial.import.errors')}</Text>
                  {result.errors.slice(0, 50).map((err, index) => (
                    <Text key={index} className={cls.errorRow}>
                      {t('autodial.import.errorRow', { row: err.row })}: {err.message}
                    </Text>
                  ))}
                </VStack>
              )}
              {(result.warnings ?? []).map((warning, index) => (
                <Text key={`warning-${index}`} variant="muted">
                  {t('autodial.import.optionalWarning', { ...warning })}
                </Text>
              ))}
            </VStack>
          )}

          {error && <Text className={cls.error}>{error}</Text>}
        </ModalBody>

        <DialogFooter className={cls.footer} data-testid="autodial-import-footer">
          <HStack gap="8" justify="end" max wrap="wrap" className={cls.footerActions}>
            <Button variant="outline" disabled={isBusy} onClick={close}>
              {step === 'done' ? t('common.close') : t('common.cancel')}
            </Button>
            {step === 'map' && (
              <Button disabled={isBusy || !previewData} onClick={() => void onValidate()}>
                {isValidating && <Loader2 size={16} className={cls.spinner} />}
                {t('autodial.workspace.validateImport')}
              </Button>
            )}
            {step === 'check' && <>
              <Button variant="outline" disabled={isBusy} onClick={() => setStep('map')}>{t('common.back')}</Button>
              <Button disabled={isBusy || !currentValidation || !validation?.ready} onClick={() => void onImport()}>
                {isImporting ? <Loader2 size={16} className={cls.spinner} /> : <Upload size={16} />}{t('autodial.import.run')}
              </Button>
            </>}
          </HStack>
        </DialogFooter>
      </FormDialogContent>
      <Dialog open={Boolean(newField)} onOpenChange={(open) => { if (!open && !isCreatingField) setNewField(null); }}>
        <FormDialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('autodial.workspace.createColumnField')}</DialogTitle></DialogHeader>
          {newField && <VStack align="stretch" gap="8">
            <Label htmlFor="ac-column-field-key">{t('autodial.workspace.newFieldKey')}</Label>
            <Input id="ac-column-field-key" value={newField.key} onChange={(e) => setNewField({ ...newField, key: e.target.value })} />
            <Label htmlFor="ac-column-field-label">{t('autodial.workspace.newFieldLabel')}</Label>
            <Input id="ac-column-field-label" value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} />
            <Label htmlFor="ac-column-field-type">{t('autodial.workspace.newFieldType')}</Label>
            <Select id="ac-column-field-type" value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value as AutodialFieldType })}>
              {(['string', 'number', 'money', 'date', 'boolean'] as const).map((type) => <option key={type} value={type}>{t(`autodial.bases.fieldTypeLabel.${type}`)}</option>)}
            </Select>
          </VStack>}
          {error && <Text role="alert">{error}</Text>}
          <DialogFooter><Button variant="outline" disabled={isCreatingField} onClick={() => setNewField(null)}>{t('common.cancel')}</Button>
            <Button disabled={isBusy || !newField || !AUTODIAL_FIELD_KEY_PATTERN.test(newField.key) || !newField.label.trim()
              || Boolean(base?.fields?.some((field) => field.key === newField.key))} onClick={() => void onCreateField()}>{t('common.save')}</Button></DialogFooter>
        </FormDialogContent>
      </Dialog>
    </Dialog>
  );
});

ImportWizard.displayName = 'ImportWizard';
