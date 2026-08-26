import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, CheckCircle2, XCircle } from 'lucide-react';
import { Button, Input, Text, Badge } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useLookupTestPhonebookMutation } from '@/shared/api/endpoints/phonebookApi';
import cls from './PhonebookLookupTest.module.scss';

export interface PhonebookLookupTestProps {
  /** Owning phonebook uid - only available for an already-saved phonebook */
  phonebookUid: number;
}

/**
 * Demo lookup test (D-10): user enters a number, sees whether it matches
 * and which PB_* vars would be set. Read-only - hits the tenant-checked
 * POST /phonebooks/:id/lookup-test endpoint (05-05).
 *
 * @layer features/phonebooks
 */
export const PhonebookLookupTest = memo(({ phonebookUid }: PhonebookLookupTestProps) => {
  const { t } = useTranslation();
  const [number, setNumber] = useState('');
  const [result, setResult] = useState<{ matched: boolean; vars: Record<string, string> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupTest, { isLoading }] = useLookupTestPhonebookMutation();

  const handleCheck = useCallback(async () => {
    const trimmed = number.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const res = await lookupTest({ uid: phonebookUid, number: trimmed }).unwrap();
      setResult(res);
    } catch (err) {
      console.error('Phonebook lookup test failed:', err);
      setResult(null);
      setError(t('phonebooks.lookupTest.error', 'Не удалось выполнить проверку. Попробуйте снова.'));
    }
  }, [number, phonebookUid, lookupTest, t]);

  const varEntries = result ? Object.entries(result.vars) : [];

  return (
    <VStack gap="8" className={cls.wrapper}>
      <Text variant="muted" className={cls.label}>
        {t('phonebooks.lookupTest.title', 'Проверка номера')}
      </Text>

      <HStack gap="8" align="center" wrap="wrap">
        <Input
          className={cls.input}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder={t('phonebooks.lookupTest.placeholder', '+79001234567')}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCheck(); }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={!number.trim() || isLoading}
        >
          <Search className={cls.checkIcon} />
          {isLoading
            ? t('common.loading', 'Загрузка...')
            : t('phonebooks.lookupTest.check', 'Проверить')}
        </Button>
      </HStack>

      {error && (
        <Text variant="small" className={cls.errorText}>{error}</Text>
      )}

      {result && (
        <VStack gap="8" className={cls.resultBox}>
          <HStack gap="8" align="center">
            {result.matched ? (
              <Badge variant="default" className={cls.matchedBadge}>
                <CheckCircle2 className={cls.badgeIcon} />
                {t('phonebooks.lookupTest.matched', 'Совпадение найдено')}
              </Badge>
            ) : (
              <Badge variant="secondary" className={cls.noMatchBadge}>
                <XCircle className={cls.badgeIcon} />
                {t('phonebooks.lookupTest.noMatch', 'Нет совпадения')}
              </Badge>
            )}
          </HStack>

          {varEntries.length > 0 && (
            <VStack gap="4" className={cls.varsTable}>
              {varEntries.map(([key, value]) => (
                <HStack key={key} gap="8" className={cls.varsRow}>
                  <Text variant="small" className={cls.varKey}>{'${PB_'}{key}{'}'}</Text>
                  <Text variant="small" className={cls.varValue}>{value}</Text>
                </HStack>
              ))}
            </VStack>
          )}
        </VStack>
      )}
    </VStack>
  );
});

PhonebookLookupTest.displayName = 'PhonebookLookupTest';
