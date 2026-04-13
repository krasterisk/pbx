import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Trash2, Plus, Music } from 'lucide-react';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import { VStack } from '@/shared/ui';
import cls from './IvrPromptsEditor.module.scss';
import { useState } from 'react';

interface IvrPromptsEditorProps {
  value: string[];
  onChange: (prompts: string[]) => void;
}

/**
 * Visual list editor for IVR prompts — select recordings from the Prompts dictionary.
 * Displays human-readable names (comment), stores filenames in the value array.
 */
export function IvrPromptsEditor({ value, onChange }: IvrPromptsEditorProps) {
  const { t } = useTranslation();
  const { data: allPrompts = [] } = useGetPromptsQuery();
  const [selectedPrompt, setSelectedPrompt] = useState('');

  const getPromptLabel = (filename: string): string => {
    const found = allPrompts.find(p => p.filename === filename);
    return found?.comment || filename;
  };

  const handleAdd = () => {
    if (!selectedPrompt) return;
    onChange([...value, selectedPrompt]);
    setSelectedPrompt('');
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...value];
    [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
    onChange(copy);
  };

  const handleMoveDown = (index: number) => {
    if (index >= value.length - 1) return;
    const copy = [...value];
    [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
    onChange(copy);
  };

  // Filter out already-selected prompts from dropdown
  const availablePrompts = allPrompts.filter(p => !value.includes(p.filename));

  return (
    <VStack gap="12" className={cls.promptsEditor}>
      {value.length === 0 && (
        <div className={cls.emptyState}>
          <Music size={32} className={cls.emptyIcon} />
          <span>{t('ivrs.prompts.empty', 'Нет записей. Добавьте аудио-файлы для воспроизведения в IVR.')}</span>
        </div>
      )}

      {value.map((filename, index) => (
        <div key={`${filename}-${index}`} className={cls.promptItem}>
          <span className={cls.promptIndex}>{index + 1}</span>
          <span className={cls.promptName}>{getPromptLabel(filename)}</span>

          <div className={cls.moveButtons}>
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
              disabled={index >= value.length - 1}
              title={t('common.moveDown', 'Вниз')}
            >
              <ChevronDown size={14} />
            </button>
          </div>

          <button
            type="button"
            className={cls.removeBtn}
            onClick={() => handleRemove(index)}
            title={t('common.delete', 'Удалить')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div className={cls.addSection}>
        <div className={cls.selectWrapper}>
          <select
            className={cls.selectInput}
            value={selectedPrompt}
            onChange={e => setSelectedPrompt(e.target.value)}
          >
            <option value="">{t('ivrs.prompts.selectPrompt', '— Выберите запись —')}</option>
            {availablePrompts.map(p => (
              <option key={p.uid} value={p.filename}>
                {p.comment || p.filename}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={cls.addBtn}
          onClick={handleAdd}
          disabled={!selectedPrompt}
        >
          <Plus size={16} />
          {t('ivrs.prompts.add', 'Добавить')}
        </button>
      </div>
    </VStack>
  );
}
