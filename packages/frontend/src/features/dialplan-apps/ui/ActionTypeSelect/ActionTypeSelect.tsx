import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Label, Select, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
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
  /** Host-provided type filter (D-15). */
  allowedTypes?: readonly ActionType[];
}

/**
 * Grouped <Select> for choosing the step application.
 * Groups options by category (telephony, media, notification, system).
 * Uses shared Select + InfoTooltip. No raw HTML.
 *
 * @layer features/dialplan-apps
 */
export const ActionTypeSelect = memo(({ value, onChange, className, allowedTypes }: ActionTypeSelectProps) => {
  const { t } = useTranslation();

  const groupedCategories = useMemo(() => {
    const groups: Record<string, IDialplanAppConfig[]> = {};
    ACTION_TYPES_LIST.forEach((item) => {
      if (allowedTypes && !allowedTypes.includes(item.type)) return;
      if (item.offerOnCreate === false && item.type !== value) return;
      const cat = item.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [allowedTypes, value]);

  const isEmpty = !value;

  return (
    <VStack gap="4" max className={className}>
      <HStack gap="4" align="center">
        <Label htmlFor="step-action-type">{t('routes.stepAction', 'Действие шага')}</Label>
        <InfoTooltip
          text={t(
            'routes.tooltips.actionType',
            'Приложение Krasterisk, которое будет выполнено на данном шаге',
          )}
        />
      </HStack>
      <Select
        id="step-action-type"
        value={value}
        onChange={(e) => onChange(e.target.value as ActionType)}
        aria-label={t('routes.stepAction', 'Действие шага')}
        className={`w-full ${isEmpty ? 'opacity-50' : ''}`}
      >
        <option value="" disabled>
          {t('routes.selectAction', 'Выберите действие')}
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
    </VStack>
  );
});

ActionTypeSelect.displayName = 'ActionTypeSelect';
