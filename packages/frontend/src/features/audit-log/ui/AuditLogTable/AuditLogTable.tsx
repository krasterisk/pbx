import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton, Text,
} from '@/shared/ui';
import { Flex } from '@/shared/ui/Stack';
import { ActionLog } from '../../model/types/AuditLogSchema';
import { AuditActionBadge } from '../AuditActionBadge/AuditActionBadge';
import cls from './AuditLogTable.module.scss';

interface AuditLogTableProps {
  data: ActionLog[];
  isLoading: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).replace(',', '');
}

const SKELETON_ROWS = [1, 2, 3, 4, 5, 6, 7, 8];

export const AuditLogTable = memo(({ data, isLoading }: AuditLogTableProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className={cls.wrap}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('auditLog.colDate')}</TableHead>
              <TableHead>{t('auditLog.colUser')}</TableHead>
              <TableHead>{t('auditLog.colAction')}</TableHead>
              <TableHead>{t('auditLog.colEntity')}</TableHead>
              <TableHead>{t('auditLog.colDetails')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SKELETON_ROWS.map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!data.length) {
    return (
      <Flex justify="center" align="center" className={cls.empty}>
        <Text variant="muted">{t('common.noData')}</Text>
      </Flex>
    );
  }

  return (
    <div className={cls.wrap}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="whitespace-nowrap">{t('auditLog.colDate')}</TableHead>
            <TableHead>{t('auditLog.colUser')}</TableHead>
            <TableHead>{t('auditLog.colAction')}</TableHead>
            <TableHead>{t('auditLog.colEntity')}</TableHead>
            <TableHead className={cls.detailsCol}>{t('auditLog.colDetails')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id} className={row.status === 'error' ? cls.rowError : ''}>
              <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                {formatDate(row.created_at)}
              </TableCell>
              <TableCell className="font-mono text-sm">{row.user_id}</TableCell>
              <TableCell>
                <AuditActionBadge action={row.action} status={row.status} />
              </TableCell>
              <TableCell>
                <Text variant="small">
                  {row.entity_type}
                  {row.entity_id ? <Text variant="muted"> #{row.entity_id}</Text> : null}
                </Text>
              </TableCell>
              <TableCell className={cls.detailsCol}>
                <Text variant="muted" className={cls.details}>{row.details || '-'}</Text>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

AuditLogTable.displayName = 'AuditLogTable';
