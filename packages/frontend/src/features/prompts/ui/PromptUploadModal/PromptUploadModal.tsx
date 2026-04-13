import { useState, useRef, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileAudio, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/Dialog';
import { Button, Input, VStack } from '@/shared/ui';
import { useUploadPromptMutation } from '@/shared/api/endpoints/promptsApi';
import cls from './PromptUploadModal.module.scss';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface PromptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PromptUploadModal({ isOpen, onClose }: PromptUploadModalProps) {
  const { t } = useTranslation();
  const [uploadPrompt, { isLoading }] = useUploadPromptMutation();

  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState('');
  const [moh, setMoh] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (f: File): boolean => {
    if (f.size > MAX_SIZE) {
      setError(t('promptsPage.upload.fileTooLarge', 'Файл превышает максимальный размер 10 МБ'));
      return false;
    }
    if (!f.type.startsWith('audio/')) {
      setError(t('promptsPage.upload.invalidFormat', 'Допускаются только аудио-файлы (WAV, MP3)'));
      return false;
    }
    setError('');
    return true;
  };

  const handleFileSelect = (f: File) => {
    if (validateFile(f)) {
      setFile(f);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleSubmit = async () => {
    if (!file || !comment.trim()) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('comment', comment.trim());
    if (moh.trim()) {
      formData.append('moh', moh.trim());
    }

    try {
      await uploadPrompt(formData).unwrap();
      setFile(null);
      setComment('');
      setMoh('');
      setError('');
      onClose();
    } catch (err) {
      console.error('Upload failed', err);
      setError('Upload failed');
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('promptsPage.upload.title', 'Загрузка аудио-записи')}</DialogTitle>
        </DialogHeader>

        <VStack gap="16">
          {!file ? (
            <div
              className={`${cls.dropzone} ${dragOver ? cls.dragOver : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={36} className={cls.dropzoneIcon} />
              <span className={cls.dropzoneText}>
                {t('promptsPage.upload.dropzone', 'Перетяните файл сюда или нажмите для выбора')}
              </span>
              <span className={cls.dropzoneHint}>
                {t('promptsPage.upload.formatHint', 'WAV или MP3. Будет автоматически сконвертирован в формат PBX (mono, 8000Hz, 16-bit). Макс. размер: 10 МБ')}
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
            </div>
          ) : (
            <div className={cls.filePreview}>
              <FileAudio size={20} className={cls.fileIcon} />
              <span className={cls.fileName}>{file.name}</span>
              <span className={cls.fileSize}>{formatSize(file.size)}</span>
              <button
                type="button"
                className={cls.removeFile}
                onClick={() => { setFile(null); setError(''); }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {error && <span className={cls.errorText}>{error}</span>}

          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">
              {t('promptsPage.upload.commentLabel', 'Название записи')} *
            </label>
            <Input
              placeholder={t('promptsPage.upload.commentPlaceholder', 'Например: Приветствие основное')}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </VStack>

          <VStack gap="4">
            <label className="text-sm font-medium text-muted-foreground">
              {t('promptsPage.upload.mohLabel', 'MOH-класс (необязательно)')}
            </label>
            <Input
              placeholder="default"
              value={moh}
              onChange={e => setMoh(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Если указано, аудио-файл будет скопирован в директорию этого класса Music on Hold.
            </span>
          </VStack>
        </VStack>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel', 'Отмена')}</Button>
          <Button onClick={handleSubmit} disabled={!file || !comment.trim() || isLoading}>
            {isLoading ? t('common.loading', 'Загрузка...') : t('common.save', 'Сохранить')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
