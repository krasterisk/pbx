import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, InfoTooltip } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import { type ActionType } from '@krasterisk/shared';
import { ACTION_TYPES_LIST } from '../../model/registry';
import { IDialplanAppConfig } from '../../model/types';

export interface ActionTypeSelectProps {
  /** Currently selected action type (empty string = nothing selected) */
  value: ActionType | '';
  /** Called with the new action type */
  onChange: (type: ActionType) => void;
  /** Optional className */
  className?: string;
}

/**
 * Grouped <Select> for choosing dialplan action type (Asterisk application).
 * Groups options by category (telephony, media, notification, system).
 * Uses shared Select + InfoTooltip. No raw HTML.
 *
 * @layer features/dialplan-apps
 */
export const ActionTypeSelect = memo(({ value, onChange, className }: ActionTypeSelectProps) => {
  const { t } = useTranslation();

  const groupedCategories = useMemo(() => {
    const groups: Record<string, IDialplanAppConfig[]> = {};
    ACTION_TYPES_LIST.forEach((item) => {
      const cat = item.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, []);

  const isEmpty = !value;

  return (
    <HStack gap="4" align="center" className={className}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as ActionType)}
        className={`w-full ${isEmpty ? 'opacity-50' : ''}`}
      >
        <option value="" disabled>
          {t('routes.selectAction', '— Выберите действие —')}
        </option>
        {Object.entries(groupedCategories).map(([category, items]) => (
          <optgroup key={category} label={t(`routes.categories.${category}`, category.toUpperCase())}>
            {items.map((at) => (
              <option key={at.type} value={at.type}>
                {t(at.labelKey, at.type)}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      <InfoTooltip text={t('routes.tooltips.actionType', 'Тип dialplan-приложения Asterisk, которое будет выполнено на данном шаге')} />
    </HStack>
  );
});

ActionTypeSelect.displayName = 'ActionTypeSelect';
