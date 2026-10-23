import type { CallsQuery } from '@krasterisk/shared';
import { useTranslation } from 'react-i18next';
import { Flex, InfoTooltip, TagInput, Select } from '@/shared/ui';
import cls from './Calls.module.scss';

export function CallNumberFilters({
  query,
  patch,
}: {
  query: CallsQuery;
  patch: (value: Record<string, string | string[] | undefined>) => void;
}) {
  const { t } = useTranslation();
  return (
    <Flex gap="8" align="center" className={cls.numberComposer}>
      <TagInput
        value={query.numbers || []}
        digitsOnly
        maxTagLength={11}
        minTagLength={2}
        invalidMessage={t('calls.numberTagError')}
        maxTags={30}
        aria-label={t('calls.numbers')}
        placeholder={t('calls.numberTagPlaceholder')}
        removeLabel={(number) => `${t('calls.removeFilter')}: ${number}`}
        onChange={(numbers) =>
          patch({
            numbers: numbers.length ? numbers : undefined,
            numberRole: numbers.length ? query.numberRole : undefined,
          })
        }
      />
      <Select
        aria-label={t('calls.numberRole')}
        value={query.numberRole || 'any'}
        onChange={(event) =>
          patch({
            numberRole:
              event.target.value === 'any' ? undefined : event.target.value,
          })
        }
      >
        {(['any', 'caller', 'recipient'] as const).map((role) => (
          <option key={role} value={role}>
            {t(`calls.numberRoles.${role}`)}
          </option>
        ))}
      </Select>
      <InfoTooltip text={t('calls.numberTagHint')} />
    </Flex>
  );
}
