import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { DirectoryLookupStatus, DirectoryMatchKind } from '@krasterisk/shared';
import { Button, Input, Text, Badge } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useLookupTestDirectoryMutation } from '@/shared/api/endpoints/directoryApi';
import cls from './DirectoryLookupTest.module.scss';

export interface DirectoryLookupTestProps {
  directoryUid: number;
  fieldUids: number[];
}

interface LookupView {
  status: DirectoryLookupStatus;
  matchKind?: DirectoryMatchKind;
  values: string[];
}

export const DirectoryLookupTest = memo(({ directoryUid, fieldUids }: DirectoryLookupTestProps) => {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [result, setResult] = useState<LookupView | null>(null);
  const [lookupTest, { isLoading }] = useLookupTestDirectoryMutation();

  const handleCheck = useCallback(async () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    try {
      const res = await lookupTest({ uid: directoryUid, key: trimmed, fieldUids }).unwrap();
      setResult({
        status: res.status,
        matchKind: res.matchKind,
        values: res.values ?? [],
      });
    } catch {
      setResult({ status: 'ERROR', values: [] });
    }
  }, [key, directoryUid, fieldUids, lookupTest]);

  return (
    <VStack gap="8" max className={cls.wrapper}>
      <Text variant="muted">{t('directories.lookupTest.title', 'Lookup test')}</Text>
      <HStack gap="8" align="center" wrap="wrap">
        <Input
          className={cls.input}
          data-testid="directory-lookup-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t('directories.lookupTest.placeholder', 'Lookup key')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCheck();
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="directory-lookup-check"
          onClick={() => void handleCheck()}
          disabled={!key.trim() || isLoading}
        >
          <Search className={cls.icon} />
          {isLoading
            ? t('common.loading')
            : t('directories.lookupTest.check', 'Check')}
        </Button>
      </HStack>

      {result && (
        <VStack gap="8" className={cls.resultBox} data-testid={`directory-lookup-${result.status}`}>
          {result.status === 'FOUND' && (
            <Badge className={cls.foundBadge}>
              <CheckCircle2 className={cls.badgeIcon} />
              {t('directories.lookupTest.found', 'FOUND')}
            </Badge>
          )}
          {result.status === 'NOT_FOUND' && (
            <Badge variant="secondary" className={cls.notFoundBadge}>
              <XCircle className={cls.badgeIcon} />
              {t('directories.lookupTest.notFound', 'NOT_FOUND')}
            </Badge>
          )}
          {result.status === 'ERROR' && (
            <Badge variant="destructive" className={cls.errorBadge}>
              <AlertTriangle className={cls.badgeIcon} />
              {t('directories.lookupTest.error', 'ERROR')}
            </Badge>
          )}
          {result.matchKind && (
            <Text variant="small">
              {t('directories.lookupTest.matchKind', 'Match')}: {result.matchKind}
            </Text>
          )}
          {result.values.length > 0 && (
            <VStack gap="4">
              {result.values.map((value, index) => (
                <Text key={`${index}-${value}`} variant="small" className={cls.value}>
                  {value}
                </Text>
              ))}
            </VStack>
          )}
        </VStack>
      )}
    </VStack>
  );
});

DirectoryLookupTest.displayName = 'DirectoryLookupTest';
