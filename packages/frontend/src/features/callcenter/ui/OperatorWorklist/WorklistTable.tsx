import { useEffect, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  HStack,
  Input,
  Text,
  VStack,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow,
} from '@/shared/ui';
import styles from './OperatorWorklist.module.scss';
export { styles as worklistStyles };

export function WorklistToolbar({
  title,
  hint,
  search,
  onSearch,
  children,
}: {
  title: string;
  hint: string;
  search: string;
  onSearch: (value: string) => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <HStack justify="between" gap="16" max className={styles.toolbar}>
      <VStack gap="4" className={styles.heading}>
        <Text as="h2">{title}</Text>
        <Text variant="small">{hint}</Text>
      </VStack>
      <HStack gap="12" className={styles.filters}>
        {children}
        <HStack gap="8" className={styles.search}>
          <Search size={16} aria-hidden />
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            aria-label={`${t('common.search')} · ${title}`}
            placeholder={t('callcenter.softphone.searchExtension')}
          />
        </HStack>
      </HStack>
    </HStack>
  );
}

export function WorklistTable({
  headers,
  children,
  empty,
  loading,
  error,
  label,
}: {
  headers: ReactNode[];
  children: ReactNode;
  empty: boolean;
  loading?: boolean;
  error?: boolean;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <VStack align="stretch" max className={styles.tableArea}>
      <Table
        surface={false}
        showSearch={false}
        showExport={false}
        className={styles.table}
        aria-label={label}
      >
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead key={index}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {children}
          {empty && (
            <TableRow>
              <TableCell colSpan={headers.length}>
                <Text
                  className={styles.empty}
                  role={error ? 'alert' : 'status'}
                >
                  {t(
                    error
                      ? 'callcenter.worklist.loadFailed'
                      : loading
                        ? 'callcenter.worklist.loading'
                        : 'callcenter.worklist.empty',
                  )}
                </Text>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </VStack>
  );
}

export function Party({
  name,
  number,
  avatar = false,
}: {
  name?: string;
  number?: string;
  avatar?: boolean;
}) {
  const label = name || number || '—';
  return (
    <HStack gap="10" className={styles.party}>
      {avatar && (
        <Text as="span" className={styles.avatar} aria-hidden>
          {label
            .split(' ')
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase()}
        </Text>
      )}
      <VStack gap="4" className={styles.identity}>
        <Text as="span" className={styles.primary}>
          {label}
        </Text>
        {number && number !== label && (
          <Text as="span" className={styles.secondary}>
            {number}
          </Text>
        )}
      </VStack>
    </HStack>
  );
}

export function WorklistStatus({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'primary' | 'danger';
}) {
  return (
    <Text as="span" className={styles.status} data-tone={tone}>
      <Text as="span" className={styles.dot} aria-hidden />
      {children}
    </Text>
  );
}

export function useWorklistClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function duration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
