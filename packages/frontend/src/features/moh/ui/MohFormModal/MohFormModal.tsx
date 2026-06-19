import { memo, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { ChevronUp, ChevronDown, Trash2, Plus, Music } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  Text,
} from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { mohActions } from '../../model/slice/mohSlice';
import {
  useCreateMohClassMutation,
  useUpdateMohClassMutation,
} from '@/shared/api/endpoints/mohApi';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import cls from './MohFormModal.module.scss';

interface MohFormData {
  displayName: string;
  sort: string;
}

interface PlaylistEntry {
  filename: string;
  label: string;
}

export const MohFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isModalOpen, selectedMoh, modalMode } = useAppSelector((s) => s.moh);
  const [createMoh, { isLoading: isCreating }] = useCreateMohClassMutation();
  const [updateMoh, { isLoading: isUpdating }] = useUpdateMohClassMutation();
  const { data: allPrompts = [] } = useGetPromptsQuery();

  const [playlist, setPlaylist] = useState<PlaylistEntry[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState('');

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<MohFormData>({
    defaultValues: { displayName: '', sort: 'random' },
  });

  useEffect(() => {
    if (isModalOpen) {
      if (modalMode === 'edit' && selectedMoh) {
        reset({
          displayName: selectedMoh.displayName || '',
          sort: selectedMoh.sort || 'random',
        });
        const entries = [...(selectedMoh.entries || [])]
          .sort((a, b) => a.position - b.position)
          .map((e) => {
            const prompt = allPrompts.find((p) => {
              return e.entry?.endsWith(p.filename) || e.filename === p.filename;
            });
            return {
              filename: e.filename || extractFilename(e.entry || ''),
              label: prompt?.comment || e.filename || extractFilename(e.entry || ''),
            };
          });
        setPlaylist(entries);
      } else {
        reset({ displayName: '', sort: 'random' });
        setPlaylist([]);
      }
      setSelectedPrompt('');
    }
  }, [isModalOpen, modalMode, selectedMoh, reset, allPrompts]);

  const extractFilename = (path: string): string => {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  };

  const getPromptLabel = useCallback(
    (filename: string): string => {
      const found = allPrompts.find((p) => p.filename === filename);
      return found?.comment || filename;
    },
    [allPrompts],
  );

  const handleAddTrack = () => {
    if (!selectedPrompt) return;
    setPlaylist((prev) => [
      ...prev,
      { filename: selectedPrompt, label: getPromptLabel(selectedPrompt) },
    ]);
    setSelectedPrompt('');
  };

  const handleRemoveTrack = (index: number) => {
    setPlaylist((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setPlaylist((prev) => {
      const copy = [...prev];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    setPlaylist((prev) => {
      if (index >= prev.length - 1) return prev;
      const copy = [...prev];
      [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
      return copy;
    });
  };

  const availablePrompts = allPrompts.filter(
    (p) => !playlist.some((entry) => entry.filename === p.filename),
  );

  const onSubmit = async (formData: MohFormData) => {
    if (playlist.length === 0) {
      return;
    }

    const entries = playlist.map((entry, index) => ({
      filename: entry.filename,
      position: index + 1,
    }));

    try {
      if (modalMode === 'edit' && selectedMoh) {
        await updateMoh({
          name: selectedMoh.name,
          data: { sort: formData.sort, entries },
        }).unwrap();
      } else {
        await createMoh({
          displayName: formData.displayName,
          sort: formData.sort,
          entries,
        }).unwrap();
      }
      dispatch(mohActions.closeModal());
    } catch (err) {
      console.error('MOH save error:', err);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      dispatch(mohActions.closeModal());
    }
  };

  const isSubmitting = isCreating || isUpdating;

  return (
    <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent size="xl" className={cls.dialogContent}>
        <DialogHeader>
          <DialogTitle>
            {modalMode === 'edit'
              ? t('moh.edit', 'Редактировать класс')
              : t('moh.add', 'Создать класс')}
          </DialogTitle>
        </DialogHeader>

        <form className={cls.form} onSubmit={handleSubmit(onSubmit)}>
          <VStack gap="16" max>
            <VStack gap="4" max className={cls.field}>
              <Label htmlFor="moh-displayName">
                {t('moh.fields.displayName', 'Название класса')} *
              </Label>
              <Input
                id="moh-displayName"
                placeholder={t('moh.placeholders.displayName', 'Например: Ожидание продаж')}
                disabled={modalMode === 'edit'}
                {...register('displayName', {
                  required: modalMode === 'create',
                })}
              />
              {errors.displayName && (
                <Text variant="small" className={cls.errorText}>
                  {t('common.error', 'Обязательное поле')}
                </Text>
              )}
            </VStack>

            <VStack gap="4" max className={cls.field}>
              <Label>{t('moh.fields.sort', 'Порядок воспроизведения')}</Label>
              <Controller
                name="sort"
                control={control}
                render={({ field }) => (
                  <HStack gap="16" className={cls.radioGroup}>
                    <label className={cls.radioOption}>
                      <input
                        type="radio"
                        value="random"
                        checked={field.value === 'random'}
                        onChange={() => field.onChange('random')}
                        className={cls.radioInput}
                      />
                      <Text as="span" variant="small" className={cls.radioLabel}>
                        {t('moh.sort.random', 'Случайно')}
                      </Text>
                    </label>
                    <label className={cls.radioOption}>
                      <input
                        type="radio"
                        value="alpha"
                        checked={field.value === 'alpha'}
                        onChange={() => field.onChange('alpha')}
                        className={cls.radioInput}
                      />
                      <Text as="span" variant="small" className={cls.radioLabel}>
                        {t('moh.sort.alpha', 'По порядку')}
                      </Text>
                    </label>
                  </HStack>
                )}
              />
            </VStack>

            <VStack gap="8" max className={cls.field}>
              <Label>{t('moh.playlist.title', 'Плейлист')}</Label>

              <VStack gap="8" max className={cls.playlistBox}>
                {playlist.length === 0 ? (
                  <VStack align="center" gap="8" className={cls.playlistEmpty}>
                    <Music size={28} className={cls.playlistEmptyIcon} />
                    <Text variant="small" className={cls.playlistEmptyText}>
                      {t(
                        'moh.playlist.empty',
                        'Добавьте аудио-файлы из справочника записей',
                      )}
                    </Text>
                  </VStack>
                ) : (
                  <VStack gap="4" max>
                    {playlist.map((entry, index) => (
                      <Flex key={`${entry.filename}-${index}`} align="center" className={cls.playlistItem}>
                        <Text as="span" className={cls.trackIndex}>
                          {index + 1}
                        </Text>
                        <Music size={14} className={cls.trackIcon} />
                        <Text as="span" className={cls.trackLabel}>
                          {entry.label}
                        </Text>

                        <HStack gap="0" className={cls.trackActions}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            title={t('common.moveUp', 'Вверх')}
                          >
                            <ChevronUp size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveDown(index)}
                            disabled={index >= playlist.length - 1}
                            title={t('common.moveDown', 'Вниз')}
                          >
                            <ChevronDown size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cls.deleteTrackBtn}
                            onClick={() => handleRemoveTrack(index)}
                            title={t('common.delete', 'Удалить')}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </HStack>
                      </Flex>
                    ))}
                  </VStack>
                )}

                <Flex align="center" className={cls.playlistAddRow}>
                  <Select
                    className={cls.promptSelect}
                    value={selectedPrompt}
                    onChange={(e) => setSelectedPrompt(e.target.value)}
                  >
                    <option value="">
                      {t('moh.playlist.selectPrompt', 'Выберите запись')}
                    </option>
                    {availablePrompts.map((p) => (
                      <option key={p.uid} value={p.filename}>
                        {p.comment || p.filename}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    onClick={handleAddTrack}
                    disabled={!selectedPrompt}
                    className={cls.addTrackBtn}
                  >
                    <Plus size={16} />
                    {t('moh.playlist.add', 'Добавить трек')}
                  </Button>
                </Flex>
              </VStack>
            </VStack>

            <DialogFooter className={cls.footer}>
              <Button
                type="button"
                variant="outline"
                onClick={() => dispatch(mohActions.closeModal())}
              >
                {t('common.cancel', 'Отмена')}
              </Button>
              <Button type="submit" disabled={isSubmitting || playlist.length === 0}>
                {isSubmitting
                  ? t('common.loading', 'Загрузка...')
                  : t('common.save', 'Сохранить')}
              </Button>
            </DialogFooter>
          </VStack>
        </form>
      </DialogContent>
    </Dialog>
  );
});

MohFormModal.displayName = 'MohFormModal';
