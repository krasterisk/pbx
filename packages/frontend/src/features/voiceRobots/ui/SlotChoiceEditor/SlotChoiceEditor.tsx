import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { VStack, HStack, Input, Label, Text, Button, TagInput } from '@/shared/ui';
import { ISlotChoice } from '@/entities/voiceRobot';
import cls from './SlotChoiceEditor.module.scss';

interface SlotChoiceEditorProps {
  choices: ISlotChoice[];
  onChange: (choices: ISlotChoice[]) => void;
}

/**
 * SlotChoiceEditor — editor for slot type="choice" variants.
 *
 * Each choice has a value (sent to webhook) and synonyms (phrases
 * the client might say). Uses TagInput for synonym management.
 *
 * FSD layer: features/voiceRobots/ui
 */
export const SlotChoiceEditor = memo(({ choices, onChange }: SlotChoiceEditorProps) => {
  const { t } = useTranslation();

  const addChoice = useCallback(() => {
    onChange([...choices, { value: '', synonyms: [] }]);
  }, [choices, onChange]);

  const removeChoice = useCallback((index: number) => {
    const next = [...choices];
    next.splice(index, 1);
    onChange(next);
  }, [choices, onChange]);

  const updateChoice = useCallback((index: number, partial: Partial<ISlotChoice>) => {
    const next = [...choices];
    next[index] = { ...next[index], ...partial };
    onChange(next);
  }, [choices, onChange]);

  return (
    <VStack gap="8" className={cls.container}>
      <Label>{t('voiceRobots.slotChoice.title', 'Варианты выбора')}</Label>

      {choices.map((choice, idx) => (
        <VStack key={idx} gap="8" className={cls.choiceCard}>
          <HStack className={cls.choiceHeader}>
            <Text className={cls.choiceIndex}>
              {t('voiceRobots.slotChoice.variant', 'Вариант')} #{idx + 1}
            </Text>
            <Button
              variant="ghost"
              size="icon"
              className={cls.removeBtn}
              onClick={() => removeChoice(idx)}
            >
              <Trash2 size={14} />
            </Button>
          </HStack>

          <VStack gap="4">
            <Label>{t('voiceRobots.slotChoice.value', 'Значение (отправляется в webhook)')}</Label>
            <Input
              value={choice.value}
              onChange={(e) => updateChoice(idx, { value: e.target.value })}
              placeholder={t('voiceRobots.slotChoice.valuePlaceholder', 'ext_105')}
            />
          </VStack>

          <VStack gap="4">
            <Label>{t('voiceRobots.slotChoice.synonyms', 'Синонимы (фразы клиента)')}</Label>
            <TagInput
              value={choice.synonyms}
              onChange={(synonyms) => updateChoice(idx, { synonyms })}
              placeholder={t('voiceRobots.slotChoice.synonymsPlaceholder', 'Нажмите Enter для добавления')}
            />
          </VStack>
        </VStack>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={addChoice}
        className={cls.addBtn}
      >
        <Plus size={14} />
        <Text>{t('voiceRobots.slotChoice.addChoice', 'Добавить вариант')}</Text>
      </Button>
    </VStack>
  );
});

SlotChoiceEditor.displayName = 'SlotChoiceEditor';
