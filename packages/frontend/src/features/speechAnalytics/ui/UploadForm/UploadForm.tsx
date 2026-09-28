import {
  memo,
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, FileAudio, Loader2, Upload, X } from 'lucide-react';
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

export interface UploadFormItem {
  file: File;
  projectId: string;
  operatorName?: string;
  clientPhone?: string;
}

export interface UploadFormSubmitPayload {
  language?: string;
  items: UploadFormItem[];
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

type DraftFile = {
  id: string;
  file: File;
  operatorName: string;
  clientPhone: string;
  open: boolean;
};

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileInvalid(file: File): boolean {
  return !ALLOWED_EXTS.has(extensionOf(file.name)) || file.size > MAX_BYTES || file.size <= 0;
}

export const UploadForm = memo(({
  open,
  onOpenChange,
  projects,
  onSubmit,
  isSubmitting = false,
  formError = null,
}: UploadFormProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState('');
  const [language, setLanguage] = useState('');
  const [drafts, setDrafts] = useState<DraftFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const errorText = localError ?? formError ?? null;
  const canSubmit = drafts.length > 0 && Boolean(projectId) && !isSubmitting;

  const resetLocal = useCallback(() => {
    setProjectId('');
    setLanguage('');
    setDrafts([]);
    setDragging(false);
    setLocalError(null);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) resetLocal();
    onOpenChange(next);
  }, [onOpenChange, resetLocal]);

  const addFiles = useCallback((list: File[]) => {
    if (!list.length) return;
    setDrafts((prev) => [
      ...prev,
      ...list.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}-${Date.now()}`,
        file,
        operatorName: '',
        clientPhone: '',
        open: false,
      })),
    ]);
    setLocalError(null);
  }, []);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    addFiles(list);
  }, [addFiles]);

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (isSubmitting) return;
    addFiles(Array.from(event.dataTransfer.files));
  }, [addFiles, isSubmitting]);

  const patchDraft = (id: string, patch: Partial<DraftFile>) => {
    setDrafts((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleSubmit = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    if (drafts.some((row) => fileInvalid(row.file))) {
      setLocalError(t(
        'speechAnalytics.errorUpload',
        'Не удалось загрузить файл. Проверьте формат (mp3/wav/ogg/m4a) и размер до 50 МБ.',
      ));
      return;
    }
    try {
      await onSubmit({
        language: language.trim() || undefined,
          items: drafts.map((row) => ({
          file: row.file,
          projectId,
          operatorName: row.operatorName.trim() || undefined,
          clientPhone: row.clientPhone.trim() || undefined,
        })),
      });
      resetLocal();
      onOpenChange(false);
    } catch {
      setLocalError(t(
        'speechAnalytics.errorUpload',
        'Не удалось загрузить файл. Проверьте формат (mp3/wav/ogg/m4a) и размер до 50 МБ.',
      ));
    }
  }, [canSubmit, drafts, language, onOpenChange, onSubmit, projectId, resetLocal, t]);

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
          <Text variant="muted" className={cls.subtitle}>
            {t('speechAnalytics.uploadHint', 'Проект и язык общие для всех файлов. У каждой записи свои оператор и номер.')}
          </Text>
        </DialogHeader>

        <form className={cls.form} onSubmit={(e) => void handleSubmit(e)} autoComplete="off">
          <VStack gap="16" max className={isSubmitting ? `${cls.body} ${cls.formDisabled}` : cls.body}>
            <div
              className={`${cls.dropZone}${dragging ? ` ${cls.dragging}` : ''}${drafts.length ? ` ${cls.hasFiles}` : ''}`}
              onDrop={onDrop}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => { if (!isSubmitting) fileInputRef.current?.click(); }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
              }}
            >
              <input
                ref={fileInputRef}
                id="sa-upload-files"
                type="file"
                accept=".mp3,.wav,.ogg,.m4a,audio/mpeg,audio/wav,audio/ogg,audio/mp4"
                multiple
                className={cls.hiddenFile}
                data-testid="upload-file-input"
                onChange={handleFileChange}
              />
              <span className={cls.dropIcon}><Upload size={22} /></span>
              <Text className={cls.dropTitle}>{t('speechAnalytics.uploadDrop', 'Перетащите файлы сюда')}</Text>
              <Text variant="muted">{t('speechAnalytics.uploadPickFiles', 'или выберите файлы')}</Text>
              <Text variant="xs">mp3, wav, ogg, m4a · 50 MB</Text>
            </div>

            {drafts.length > 0 ? (
              <VStack gap="12" max data-testid="upload-file-list">
                <div className={cls.shared}>
                  <VStack gap="4" max>
                    <Label htmlFor="sa-upload-project">
                      {t('speechAnalytics.routeProjectLabel', 'Проект аналитики')} *
                    </Label>
                    <Select
                      id="sa-upload-project"
                      value={projectId}
                      disabled={isSubmitting}
                      data-testid="upload-project"
                      onChange={(e) => setProjectId(e.target.value)}
                    >
                      <option value="">
                        {t('speechAnalytics.uploadProjectPlaceholder', 'Выбрать проект')}
                      </option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </Select>
                  </VStack>
                  <VStack gap="4" max>
                    <Label htmlFor="sa-upload-lang">{t('speechAnalytics.uploadLanguage', 'Язык')}</Label>
                    <Input
                      id="sa-upload-lang"
                      value={language}
                      disabled={isSubmitting}
                      placeholder="ru"
                      onChange={(e) => setLanguage(e.target.value)}
                    />
                  </VStack>
                </div>
                <HStack justify="between" max align="center">
                  <Text className={cls.listTitle}>{t('speechAnalytics.uploadFiles', 'Файлы')}</Text>
                  <span className={cls.count}>{drafts.length}</span>
                </HStack>
                {drafts.map((row) => (
                  <div key={row.id} className={cls.fileCard}>
                    <div className={cls.fileHead}>
                      <button
                        type="button"
                        className={cls.fileToggle}
                        aria-expanded={row.open}
                        onClick={() => patchDraft(row.id, { open: !row.open })}
                      >
                        {row.open
                          ? <ChevronDown size={16} className={cls.chevron} aria-hidden />
                          : <ChevronRight size={16} className={cls.chevron} aria-hidden />}
                        <span className={cls.fileIcon}><FileAudio size={16} /></span>
                        <span className={cls.fileMeta}>
                          <span className={cls.fileName}>{row.file.name}</span>
                          <span className={cls.fileSize}>{formatFileSize(row.file.size)}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={cls.removeBtn}
                        aria-label={t('common.delete', 'Удалить')}
                        onClick={() => setDrafts((prev) => prev.filter((item) => item.id !== row.id))}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {row.open ? (
                    <div className={cls.fileFields}>
                      <VStack gap="4" max>
                        <Label htmlFor={`sa-upload-op-${row.id}`}>{t('speechAnalytics.uploadOperator', 'Оператор')}</Label>
                        <Input
                          id={`sa-upload-op-${row.id}`}
                          value={row.operatorName}
                          placeholder={t('speechAnalytics.uploadOperatorNamePh', 'Имя оператора')}
                          disabled={isSubmitting}
                          onChange={(e) => patchDraft(row.id, { operatorName: e.target.value })}
                        />
                      </VStack>
                      <VStack gap="4" max>
                        <Label htmlFor={`sa-upload-phone-${row.id}`}>{t('speechAnalytics.uploadClientPhone', 'Телефон клиента')}</Label>
                        <Input
                          id={`sa-upload-phone-${row.id}`}
                          value={row.clientPhone}
                          disabled={isSubmitting}
                          onChange={(e) => patchDraft(row.id, { clientPhone: e.target.value })}
                        />
                      </VStack>
                    </div>
                    ) : null}
                  </div>
                ))}
              </VStack>
            ) : null}

            {isSubmitting ? (
              <div className={cls.progressWrap}>
                <div className={cls.progressBar} />
                <Text variant="xs">{t('speechAnalytics.uploadSubmitBusy', 'Загрузка...')}</Text>
              </div>
            ) : null}

            {errorText ? (
              <Text className={cls.error} data-testid="upload-form-error">{errorText}</Text>
            ) : null}

            <HStack justify="end" gap="8" max>
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => handleOpenChange(false)}>
                {t('common.cancel', 'Отмена')}
              </Button>
              <Button type="submit" disabled={!canSubmit} data-testid="upload-submit">
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
