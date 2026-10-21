import { PhoneCall, RefreshCw, ExternalLink } from 'lucide-react';
import { Button, Input, Text, VStack, HStack, Tooltip } from '@/shared/ui';
import styles from './PhoneList.module.scss';

export interface PhoneListRow {
  id: string; name: string; number: string; detail?: string; missed?: boolean;
}
export function PhoneList({ rows, search, onSearch, placeholder, loading, error, empty, retryLabel, onRetry,
  canCall, onCall, callLabel, onOpen, openLabel, hasMore, onMore, moreLabel }: {
  rows: PhoneListRow[]; search?: string; onSearch?: (value: string) => void; placeholder?: string;
  loading?: boolean; error?: string; empty: string; retryLabel: string; onRetry: () => void;
  canCall: boolean; onCall: (number: string) => void; callLabel: string;
  onOpen?: (id: string) => void; openLabel?: string; hasMore?: boolean; onMore?: () => void; moreLabel?: string;
}) {
  return <VStack gap="8" max className={styles.wrap}>
    {onSearch && <Input aria-label={placeholder} placeholder={placeholder} value={search} onChange={e => onSearch(e.target.value)}/>}
    <HStack justify="end" max><Tooltip content={retryLabel}><Button size="sm" variant="ghost" aria-label={retryLabel} onClick={onRetry}><RefreshCw size={14}/></Button></Tooltip></HStack>
    {error ? <Text role="alert">{error}</Text> : !loading && rows.length === 0 ? <Text variant="muted">{empty}</Text> : null}
    <VStack gap="4" max className={styles.list} aria-busy={loading}>
      {rows.map(row => <HStack key={row.id} gap="8" max className={`${styles.row} ${row.missed ? styles.missed : ''}`}>
        <VStack gap="4" className={styles.identity}><Text className={styles.name}>{row.name || row.number}</Text>
          {row.name !== row.number && <Text variant="muted">{row.number}</Text>}
          {row.detail && <Text variant="muted" className={styles.detail}>{row.detail}</Text>}
        </VStack>
        {onOpen && <Tooltip content={openLabel}><Button size="sm" variant="ghost" aria-label={`${openLabel} ${row.number}`} onClick={() => onOpen(row.id)}><ExternalLink size={15}/></Button></Tooltip>}
        <Tooltip content={callLabel}><Button size="sm" variant="outline" disabled={!canCall || !row.number} aria-label={`${callLabel} ${row.number}`} onClick={() => onCall(row.number)}><PhoneCall size={15}/></Button></Tooltip>
      </HStack>)}
    </VStack>
    {hasMore && onMore && <Button variant="ghost" size="sm" onClick={onMore} disabled={loading}>{moreLabel}</Button>}
  </VStack>;
}
