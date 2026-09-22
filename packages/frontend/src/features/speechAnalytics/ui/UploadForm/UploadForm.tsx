import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Upload } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import cls from './UploadForm.module.scss';

const ALLOWED_EXTS = new Set(['mp3', 'wav', 'ogg', 'm4a']);
const MAX_BYTES = 50 * 1024 * 1024;

export interface UploadFormProject {
  id: string;
  name: string;
}

export interface UploadFormOperator {
  id: number;
  name: string;
}

export interface UploadFormSubmitPayload {
  projectId: string;
  operator?: { userId?: number; name?: string };
  clientPhone?: string;
  language?: string;
  files: File[];
}

export interface UploadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: UploadFormProject[];
  operators?: UploadFormOperator[];
  onSubmit: (payload: UploadFormSubmitPayload) => Promise<void>;
  isSubmitting?: boolean;
  formError?: string | null;
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function validateFiles(files: File[]): string | null {
  for (const file of files) {
    const ext = extensionOf(file.name);
    if (!ALLOWED_EXTS.has(ext) || file.size > MAX_BYTES || file.size <= 0) {
      return 'format_or_size';
    }
  }
  return null;
}

export const UploadForm = memo(({
  open,
  onOpenChange,
  projects,
  operators = [],
  onSubmit,
  isSubmitting = false,
  formError = null,
}: UploadFormProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projectId, setProjectId] = useState('');
  const [operatorMode, setOperatorMode] = useState<'user' | 'name'>('name');
  const [operatorUserId, setOperatorUserId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [language, setLanguage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const errorText = localError
    ?? formError
    ?? null;

  const canSubmit = Boolean(projectId) && files.length > 0 && !isSubmitting;

  const operatorOptions = useMemo(() => operators, [operators]);

  const resetLocal = useCallback(() => {
    setProjectId('');
    setOperatorMode('name');
    setOperatorUserId('');
    setOperatorName('');
    setClientPhone('');
    setLanguage('');
    setFiles([]);
    setLocalError(null);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) resetLocal();
    onOpenChange(next);
  }, [onOpenChange, resetLocal]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    setFiles(list);
    setLocalError(null);
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId || files.length === 0 || isSubmitting) return;

    const invalid = validateFiles(files);
    if (invalid) {
      setLocalError(
        t(
          'speechAnalytics.errorUpload',
          'Не удалось загрузить файл. Проверьте формат (mp3/wav/ogg/m4a) и размер до 50 МБ.',
        ),
      );
      return;
    }

    const operator =
      operatorMode === 'user' && operatorUserId
        ? { userId: Number(operatorUserId) }
        : operatorName.trim()
          ? { name: operatorName.trim() }
          : undefined;

    try {
      await onSubmit({
        projectId,
        operator,
        clientPhone: clientPhone.trim() || undefined,
        language: language.trim() || undefined,
        files,
      });
      resetLocal();
      onOpenChange(false);
    } catch {
      setLocalError(
        t(
          'speechAnalytics.errorUpload',
          'Не удалось загрузить файл. Проверьте формат (mp3/wav/ogg/m4a) и размер до 50 МБ.',
        ),
      );
    }
  }, [
    clientPhone,
    files,
    isSubmitting,
    language,
    onOpenChange,
    onSubmit,
    operatorMode,
    operatorName,
    operatorUserId,
    projectId,
    resetLocal,
    t,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="xl"
        className={cls.dialog}
        data-testid="upload-form"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {t('speechAnalytics.uploadRecording', 'Загрузить запись')}
          </DialogTitle>
        </DialogHeader>

        <form className={cls.form} onSubmit={(e) => void handleSubmit(e)} autoComplete="off">
          <VStack gap="16" max className={cls.body}>
            <VStack gap="8" max className={cls.field}>
              <Label htmlFor="sa-upload-project">
                {t('speechAnalytics.routeProjectLabel', 'Проект аналитики')} *
              </Label>
              <Select
                id="sa-upload-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={isSubmitting}
                data-testid="upload-project"
              >
                <option value="">
                  {t('speechAnalytics.routeProjectPlaceholder', 'Без проекта')}
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </VStack>

            <VStack gap="8" max className={cls.field}>
              <Label htmlFor="sa-upload-operator">
                {t('speechAnalytics.uploadOperator', 'Оператор')}
              </Label>
              <HStack gap="8" max className={cls.operatorRow}>
                <Select
                  id="sa-upload-operator-mode"
                  value={operatorMode}
                  onChange={(e) => setOperatorMode(e.target.value as 'user' | 'name')}
                  disabled={isSubmitting}
                  aria-label={t('speechAnalytics.uploadOperatorMode', 'Способ выбора')}
                >
                  <option value="name">
                    {t('speechAnalytics.uploadOperatorFreeText', 'Имя текстом')}
                  </option>
                  <option value="user">
                    {t('speechAnalytics.uploadOperatorUser', 'Пользователь кабинета')}
                  </option>
                </Select>
                {operatorMode === 'user' ? (
                  <Select
                    id="sa-upload-operator"
                    value={operatorUserId}
                    onChange={(e) => setOperatorUserId(e.target.value)}
                    disabled={isSubmitting}
                    className={cls.wrapField}
                  >
                    <option value="">
                      {t('speechAnalytics.uploadOperatorPick', 'Выберите оператора')}
                    </option>
                    {operatorOptions.map((op) => (
                      <option key={op.id} value={String(op.id)}>
                        {op.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id="sa-upload-operator"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    disabled={isSubmitting}
                    className={cls.wrapField}
                    placeholder={t('speechAnalytics.uploadOperatorNamePh', 'Имя оператора')}
                  />
                )}
              </HStack>
            </VStack>

            <HStack gap="12" max className={cls.optionalRow}>
              <VStack gap="8" max className={cls.field}>
                <Label htmlFor="sa-upload-phone">
                  {t('speechAnalytics.uploadClientPhone', 'Телефон клиента')}
                </Label>
                <Input
                  id="sa-upload-phone"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  disabled={isSubmitting}
                  className={cls.wrapField}
                />
              </VStack>
              <VStack gap="8" max className={cls.field}>
                <Label htmlFor="sa-upload-lang">
                  {t('speechAnalytics.uploadLanguage', 'Язык')}
                </Label>
                <Input
                  id="sa-upload-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isSubmitting}
                  className={cls.wrapField}
                />
              </VStack>
            </HStack>

            <VStack gap="8" max className={cls.field}>
              <Label htmlFor="sa-upload-files">
                {t('speechAnalytics.uploadFiles', 'Файлы')}
              </Label>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => fileInputRef.current?.click()}
                data-testid="upload-pick-files"
              >
                <Upload size={16} />
                {t('speechAnalytics.uploadPickFiles', 'Выбрать файлы')}
              </Button>
              <input
                ref={fileInputRef}
                id="sa-upload-files"
                type="file"
                accept=".mp3,.wav,.ogg,.m4a,audio/mpeg,audio/wav,audio/ogg,audio/mp4"
                multiple
                className={cls.hiddenFile}
                data-testid="upload-file-input"
                tabIndex={-1}
                aria-hidden="true"
                onChange={handleFileChange}
              />
              {files.length > 0 ? (
                <VStack gap="4" max className={cls.fileList} data-testid="upload-file-list">
                  {files.map((file) => (
                    <Text key={`${file.name}-${file.size}`} className={cls.fileName}>
                      {file.name}
                    </Text>
                  ))}
                </VStack>
              ) : null}
            </VStack>

            {errorText ? (
              <Text className={cls.error} data-testid="upload-form-error">
                {errorText}
              </Text>
            ) : null}

            <HStack justify="end" gap="8" max>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => handleOpenChange(false)}
              >
                {t('common.cancel', 'Отмена')}
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                data-testid="upload-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className={cls.spinner} />
                    {t('speechAnalytics.uploadSubmitBusy', 'Загрузка...')}
                  </>
                ) : (
                  t('speechAnalytics.uploadRecording', 'Загрузить запись')
                )}
              </Button>
            </HStack>
          </VStack>
        </form>
      </DialogContent>
    </Dialog>
  );
});

UploadForm.displayName = 'UploadForm';
