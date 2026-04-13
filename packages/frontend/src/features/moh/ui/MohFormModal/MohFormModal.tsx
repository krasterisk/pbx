import { memo, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { ChevronUp, ChevronDown, Trash2, Plus, Music } from 'lucide-react';
import { Button, Input, Label } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
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
        // Restore playlist from entries
        const entries = (selectedMoh.entries || [])
          .sort((a, b) => a.position - b.position)
          .map((e) => {
            const prompt = allPrompts.find((p) => {
              // entry contains absolute path, filename is the basename
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

  // Playlist management
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

  // Filter out already-selected prompts from dropdown
  const availablePrompts = allPrompts.filter(
    (p) => !playlist.some((entry) => entry.filename === p.filename),
  );

  const onSubmit = async (formData: MohFormData) => {
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

  if (!isModalOpen) return null;

  const isSubmitting = isCreating || isUpdating;

  return (
    <div className={cls.overlay} onClick={() => dispatch(mohActions.closeModal())}>
      <div className={cls.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={cls.title}>
          {modalMode === 'edit'
            ? t('moh.edit', 'Редактировать класс')
            : t('moh.add', 'Создать класс')}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)}>
          <VStack gap="16" max>
            {/* Display Name */}
            <VStack gap="4" max>
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
                <span className={cls.error}>{t('common.error', 'Обязательное поле')}</span>
              )}
            </VStack>

            {/* Sort */}
            <VStack gap="4" max>
              <Label>{t('moh.fields.sort', 'Порядок воспроизведения')}</Label>
              <Controller
                name="sort"
                control={control}
                render={({ field }) => (
                  <HStack gap="16">
                    <label className={cls.radioLabel}>
                      <input
                        type="radio"
                        value="random"
                        checked={field.value === 'random'}
                        onChange={() => field.onChange('random')}
                        className={cls.radioInput}
                      />
                      <span className={cls.radioText}>
                        {t('moh.sort.random', 'Случайно')}
                      </span>
                    </label>
                    <label className={cls.radioLabel}>
                      <input
                        type="radio"
                        value="alpha"
                        checked={field.value === 'alpha'}
                        onChange={() => field.onChange('alpha')}
                        className={cls.radioInput}
                      />
                      <span className={cls.radioText}>
                        {t('moh.sort.alpha', 'По порядку')}
                      </span>
                    </label>
                  </HStack>
                )}
              />
            </VStack>

            {/* Playlist Editor */}
            <VStack gap="8" max>
              <Label>{t('moh.playlist.title', 'Плейлист')}</Label>

              <div className={cls.playlistContainer}>
                {playlist.length === 0 ? (
                  <div className={cls.emptyPlaylist}>
                    <Music size={28} className={cls.emptyIcon} />
                    <span>
                      {t(
                        'moh.playlist.empty',
                        'Добавьте аудио-файлы из справочника записей',
                      )}
                    </span>
                  </div>
                ) : (
                  <VStack gap="4" max>
                    {playlist.map((entry, index) => (
                      <div key={`${entry.filename}-${index}`} className={cls.playlistItem}>
                        <span className={cls.trackIndex}>{index + 1}</span>
                        <Music size={14} className={cls.trackIcon} />
                        <span className={cls.trackName}>{entry.label}</span>

                        <div className={cls.trackActions}>
                          <button
                            type="button"
                            className={cls.moveBtn}
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            title={t('common.moveUp', 'Вверх')}
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            className={cls.moveBtn}
                            onClick={() => handleMoveDown(index)}
                            disabled={index >= playlist.length - 1}
                            title={t('common.moveDown', 'Вниз')}
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            type="button"
                            className={cls.removeBtn}
                            onClick={() => handleRemoveTrack(index)}
                            title={t('common.delete', 'Удалить')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </VStack>
                )}

                {/* Add track section */}
                <div className={cls.addSection}>
                  <select
                    className={cls.selectInput}
                    value={selectedPrompt}
                    onChange={(e) => setSelectedPrompt(e.target.value)}
                  >
                    <option value="">
                      {t('moh.playlist.selectPrompt', '— Выберите запись —')}
                    </option>
                    {availablePrompts.map((p) => (
                      <option key={p.uid} value={p.filename}>
                        {p.comment || p.filename}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={cls.addBtn}
                    onClick={handleAddTrack}
                    disabled={!selectedPrompt}
                  >
                    <Plus size={16} />
                    {t('moh.playlist.add', 'Добавить трек')}
                  </button>
                </div>
              </div>
            </VStack>

            {/* Form buttons */}
            <HStack gap="8" justify="end" max className={cls.formButtons}>
              <Button
                type="button"
                variant="outline"
                onClick={() => dispatch(mohActions.closeModal())}
              >
                {t('common.cancel', 'Отмена')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? t('common.loading', 'Загрузка...')
                  : t('common.save', 'Сохранить')}
              </Button>
            </HStack>
          </VStack>
        </form>
      </div>
    </div>
  );
});

MohFormModal.displayName = 'MohFormModal';
