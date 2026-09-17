import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X, AlertCircle } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton, Button, Text, TableRowActions, TableRowAction,
} from '@/shared/ui';
import { Flex, VStack, HStack } from '@/shared/ui/Stack';
import {
  WebhookFailure,
  useRetryWebhookFailureMutation,
  useResolveWebhookFailureMutation,
  useResolveAllWebhookFailuresMutation,
} from '../../api/auditLogApi';
import cls from './WebhookFailuresTable.module.scss';

interface WebhookFailuresTableProps {
  data: WebhookFailure[];
  isLoading: boolean;
  total: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).replace(',', '');
}

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 30);
  } catch {
    return url.slice(0, 40);
  }
}

const EVENT_COLORS: Record<string, string> = {
  on_hangup: cls.badgeHangup,
  on_answer: cls.badgeAnswer,
  before_dial: cls.badgeDial,
  custom: cls.badgeCustom,
};

const SKELETON_ROWS = [1, 2, 3, 4];

export const WebhookFailuresTable = memo(({ data, isLoading, total }: WebhookFailuresTableProps) => {
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState<number | null>(null);
  const [retry] = useRetryWebhookFailureMutation();
  const [resolve] = useResolveWebhookFailureMutation();
  const [resolveAll, { isLoading: isResolvingAll }] = useResolveAllWebhookFailuresMutation();

  const handleRetry = async (id: number) => {
    setRetrying(id);
    try { await retry(id); } finally { setRetrying(null); }
  };

  if (isLoading) {
    return (
      <Flex direction="column" align="stretch" className={cls.wrap} max>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('auditLog.whColDate')}</TableHead>
              <TableHead>{t('auditLog.whColEvent')}</TableHead>
              <TableHead>{t('auditLog.whColUrl')}</TableHead>
              <TableHead>{t('auditLog.whColError')}</TableHead>
              <TableHead>{t('auditLog.whColAttempts')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {SKELETON_ROWS.map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className={cls.skelDate} /></TableCell>
                <TableCell><Skeleton className={cls.skelEvent} /></TableCell>
                <TableCell><Skeleton className={cls.skelUrl} /></TableCell>
                <TableCell><Skeleton className={cls.skelError} /></TableCell>
                <TableCell><Skeleton className={cls.skelAttempts} /></TableCell>
                <TableCell><Skeleton className={cls.skelActions} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Flex>
    );
  }

  if (!data.length) {
    return (
      <VStack gap="8" align="center" className={cls.empty}>
        <AlertCircle size={32} className={cls.emptyIcon} />
        <Text variant="muted">{t('auditLog.whEmpty')}</Text>
      </VStack>
    );
  }

  return (
    <VStack gap="0" max>
      {total > 0 && (
        <HStack justify="end" className={cls.toolbar}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolveAll(undefined)}
            disabled={isResolvingAll}
          >
            {t('auditLog.whResolveAll')}
          </Button>
        </HStack>
      )}
      <Flex direction="column" align="stretch" className={cls.wrap} max>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={cls.nowrap}>{t('auditLog.whColDate')}</TableHead>
              <TableHead>{t('auditLog.whColEvent')}</TableHead>
              <TableHead>{t('auditLog.whColUrl')}</TableHead>
              <TableHead className={cls.errorCol}>{t('auditLog.whColError')}</TableHead>
              <TableHead className={cls.center}>{t('auditLog.whColAttempts')}</TableHead>
              <TableHead className={cls.right}>{t('auditLog.whColActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id} className={row.retried_at ? cls.rowRetried : ''}>
                <TableCell className={cls.dateCell}>
                  <Text as="span">{formatDate(row.failed_at)}</Text>
                </TableCell>
                <TableCell>
                  <Text as="span" className={`${cls.badge} ${EVENT_COLORS[row.event] ?? cls.badgeCustom}`}>
                    {row.event}
                  </Text>
                </TableCell>
                <TableCell title={row.url} className={cls.urlCell}>
                  <Text variant="small" className={cls.url}>{shortUrl(row.url)}</Text>
                </TableCell>
                <TableCell className={cls.errorCol}>
                  <Text variant="muted" className={cls.error}>{row.error || '-'}</Text>
                </TableCell>
                <TableCell className={cls.attemptsCell}>
                  <Text as="span">{row.attempts}</Text>
                </TableCell>
                <TableCell>
                  <TableRowActions>
                    <TableRowAction
                      title={t('auditLog.whRetry')}
                      aria-label={t('auditLog.whRetry')}
                      disabled={retrying === row.id}
                      onClick={() => void handleRetry(row.id)}
                    >
                      <RefreshCw />
                    </TableRowAction>
                    <TableRowAction
                      title={t('auditLog.whResolve')}
                      aria-label={t('auditLog.whResolve')}
                      onClick={() => resolve(row.id)}
                    >
                      <X />
                    </TableRowAction>
                  </TableRowActions>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Flex>
    </VStack>
  );
});

WebhookFailuresTable.displayName = 'WebhookFailuresTable';
