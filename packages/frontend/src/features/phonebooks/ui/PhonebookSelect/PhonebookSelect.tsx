import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiSelect, type MultiSelectOption, InfoTooltip, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetPhonebooksQuery } from '@/shared/api/endpoints/phonebookApi';
import { Label } from '@/shared/ui';

export interface PhonebookSelectProps {
  /** Currently selected phonebook UIDs */
  value: number[];
  /** Called with new array of selected phonebook UIDs */
  onChange: (uids: number[]) => void;
  /** Optional className */
  className?: string;
}

/**
 * Multi-select for choosing route phonebooks.
 * Auto-fetches phonebooks from API. Uses shared MultiSelect + InfoTooltip.
 *
 * @layer features/phonebooks
 */
export const PhonebookSelect = memo(({ value, onChange, className }: PhonebookSelectProps) => {
  const { t } = useTranslation();
  const { data: phonebooks = [] } = useGetPhonebooksQuery();

  const options: MultiSelectOption[] = useMemo(
    () => phonebooks.map((pb) => ({
      value: String(pb.uid),
      label: pb.name,
      description: pb.invert
        ? t('phonebooks.invertMode', 'Инвертирован')
        : undefined,
    })),
    [phonebooks, t],
  );

  const handleChange = (csv: string) => {
    const uids = csv ? csv.split(',').filter(Boolean).map(Number) : [];
    onChange(uids);
  };

  return (
    <VStack gap="4" className={className}>
      <HStack gap="4" align="center">
        <Label>{t('phonebooks.routePhonebooks', 'Справочники')}</Label>
        <InfoTooltip text={t('phonebooks.routePhonebooksTooltip', 'Выберите справочники для проверки CallerID.')} />
      </HStack>
      <MultiSelect
        value={value.map(String)}
        onChange={handleChange}
        options={options}
        placeholder={t('phonebooks.noPhonebooks', 'Нет справочников')}
      />
    </VStack>
  );
});

PhonebookSelect.displayName = 'PhonebookSelect';
