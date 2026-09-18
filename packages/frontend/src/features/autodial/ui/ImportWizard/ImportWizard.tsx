import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, Upload } from 'lucide-react';
import type { AutodialDedupPolicy, AutodialImportSource, IAutodialColumnMap } from '@krasterisk/shared';
import {
  Badge,
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

type Step = 'upload' | 'map' | 'done';

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

  const [step, setStep] = useState<Step>('upload');
  const [filename, setFilename] = useState('');
  const [source, setSource] = useState<AutodialImportSource>('csv');
  const [content, setContent] = useState('');
  const [delimiter, setDelimiter] = useState(';');
  const [hasHeader, setHasHeader] = useState(true);
  const [replace, setReplace] = useState(false);
  const [previewData, setPreviewData] = useState<AutodialImportPreview | null>(null);
  const [columnMap, setColumnMap] = useState<IAutodialColumnMap[]>([]);
  const [profileName, setProfileName] = useState('');
  const [result, setResult] = useState<AutodialImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileUid, setProfileUid] = useState<number | undefined>();
  const [dedup, setDedup] = useState<AutodialDedupPolicy | undefined>();
  const [isReading, setIsReading] = useState(false);
  const generation = useRef(0);
  const isBusy = isReading || isPreviewing || isImporting || isSavingProfile;

  useEffect(() => {
    generation.current += 1;
    if (isOpen) return () => { generation.current += 1; };
    setStep('upload');
    setFilename('');
    setContent('');
    setPreviewData(null);
    setColumnMap([]);
    setResult(null);
    setError(null);
    setProfileName('');
    setReplace(false);
    setProfileUid(undefined);
    setDedup(undefined);
    setIsReading(false);
    return () => { generation.current += 1; };
  }, [isOpen, baseUid]);

  const close = () => dispatch(autodialPageActions.closeImport());

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

  const onImport = async () => {
    if (isBusy || !previewData) return;
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
      const res = await runImport({
        baseUid,
        filename,
        source,
        content_base64: content,
        column_map: columnMap,
        delimiter,
        has_header: hasHeader,
        replace,
        expected_revision: previewData.base_revision,
        profile_uid: profileUid,
        dedup_policy: dedup,
      }).unwrap();
      if (request !== generation.current) return;
      setResult(res);
      setStep('done');
    } catch (error) {
      if (request === generation.current) setError(t(autodialErrorKey(error, 'autodial.import.importFailed')));
    }
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
      <DialogContent size="large" className={cls.dialog} data-testid="autodial-import-wizard">
        <DialogHeader className={cls.header}>
          <DialogTitle>{t('autodial.import.title')}</DialogTitle>
        </DialogHeader>

        <VStack
          gap="16"
          max
          className={cls.body}
          data-testid="autodial-import-body"
          data-viewport="360,768,1440"
          data-overflow="y"
        >
          {step === 'upload' && (
            <VStack gap="12" max>
              <Text className={cls.hint}>{t('autodial.import.uploadHint')}</Text>
              <HStack gap="12" align="end" wrap="wrap">
                <VStack gap="4">
                  <Label htmlFor="autodial-import-file">{t('autodial.import.file')}</Label>
                  <Input
                    id="autodial-import-file"
                    type="file"
                    accept=".csv,.txt,.xlsx"
                    disabled={isBusy}
                    onChange={(e) => void onFile(e.target.files?.[0])}
                  />
                </VStack>
                <VStack gap="4">
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
                  <Checkbox
                    id="autodial-import-header"
                    checked={hasHeader}
                    disabled={isBusy}
                    onChange={(e) => setHasHeader(e.target.checked)}
                  />
                  <Label htmlFor="autodial-import-header">{t('autodial.import.hasHeader')}</Label>
                </HStack>
              </HStack>
              {isPreviewing && <Loader2 size={18} className={cls.spinner} />}
            </VStack>
          )}

          {step === 'map' && previewData && (
            <VStack gap="16" max>
              <HStack gap="12" align="end" wrap="wrap">
                <Badge variant="outline">
                  {t('autodial.import.rowsFound', { count: previewData.total_rows })}
                </Badge>
                {(profiles ?? []).length > 0 && (
                  <VStack gap="4">
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
              </HStack>

              <div className={cls.tableScroll}>
                <Table>
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
                <VStack gap="4">
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

          {step === 'done' && result && (
            <VStack gap="12" max>
              <HStack gap="12" wrap="wrap">
                <Badge>{t('autodial.import.imported', { count: result.imported })}</Badge>
                <Badge variant="secondary">
                  {t('autodial.import.skipped', { count: result.skipped })}
                </Badge>
              </HStack>
              {result.errors.length > 0 && (
                <VStack gap="4" max className={cls.errorList}>
                  <Text className={cls.sectionTitle}>{t('autodial.import.errors')}</Text>
                  {result.errors.slice(0, 50).map((err, index) => (
                    <Text key={index} className={cls.errorRow}>
                      {t('autodial.import.errorRow', { row: err.row })}: {err.message}
                    </Text>
                  ))}
                </VStack>
              )}
            </VStack>
          )}

          {error && <Text className={cls.error}>{error}</Text>}
        </VStack>

        <DialogFooter className={cls.footer} data-testid="autodial-import-footer">
          <HStack gap="8" justify="end" max wrap="wrap" className={cls.footerActions}>
            <Button variant="outline" disabled={isBusy} onClick={close}>
              {step === 'done' ? t('common.close') : t('common.cancel')}
            </Button>
            {step === 'map' && (
              <Button disabled={isBusy || !previewData} onClick={() => void onImport()}>
                {isImporting ? <Loader2 size={16} className={cls.spinner} /> : <Upload size={16} />}
                {t('autodial.import.run')}
              </Button>
            )}
          </HStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ImportWizard.displayName = 'ImportWizard';
