import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X, AlertCircle } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton, Button, Text,
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
  on_hangup:  cls.badgeHangup,
  on_answer:  cls.badgeAnswer,
  before_dial: cls.badgeDial,
  custom:     cls.badgeCustom,
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
      <div className={cls.wrap}>
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
                {[140, 80, 180, 200, 40, 80].map((w, j) => (
                  <TableCell key={j}><Skeleton className={`h-4 w-[${w}px]`} /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!data.length) {
    return (
      <VStack gap="8" align="center" className={cls.empty}>
        <AlertCircle className={cls.emptyIcon} />
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
      <div className={cls.wrap}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="whitespace-nowrap">{t('auditLog.whColDate')}</TableHead>
              <TableHead>{t('auditLog.whColEvent')}</TableHead>
              <TableHead>{t('auditLog.whColUrl')}</TableHead>
              <TableHead className={cls.errorCol}>{t('auditLog.whColError')}</TableHead>
              <TableHead className="text-center">{t('auditLog.whColAttempts')}</TableHead>
              <TableHead className="text-right">{t('auditLog.whColActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id} className={row.retried_at ? cls.rowRetried : ''}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(row.failed_at)}
                </TableCell>
                <TableCell>
                  <span className={`${cls.badge} ${EVENT_COLORS[row.event] ?? cls.badgeCustom}`}>
                    {row.event}
                  </span>
                </TableCell>
                <TableCell title={row.url} className={cls.urlCell}>
                  <Text variant="small" className={cls.url}>{shortUrl(row.url)}</Text>
                </TableCell>
                <TableCell className={cls.errorCol}>
                  <Text variant="muted" className={cls.error}>{row.error || '-'}</Text>
                </TableCell>
                <TableCell className="text-center font-mono text-sm">{row.attempts}</TableCell>
                <TableCell>
                  <Flex gap="4" justify="end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={retrying === row.id}
                      onClick={() => handleRetry(row.id)}
                    >
                      <RefreshCw className={`${cls.btnIcon} ${retrying === row.id ? cls.spin : ''}`} />
                      {t('auditLog.whRetry')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resolve(row.id)}
                    >
                      <X className={cls.btnIcon} />
                    </Button>
                  </Flex>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </VStack>
  );
});

WebhookFailuresTable.displayName = 'WebhookFailuresTable';
