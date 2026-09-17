import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge, RecordingButton, TableRowAction, TableRowActions, Text, Tooltip } from '@/shared/ui';
import type { IServiceRequest } from '@/entities/serviceRequest';
import { REQUEST_STATUS_OPTIONS, SMS_STATUS_OPTIONS } from '@/entities/serviceRequest';
import cls from './ServiceRequestsTable.module.scss';

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  new: 'outline',
  in_progress: 'secondary',
  completed: 'default',
  postponed: 'secondary',
  impossible: 'destructive',
};

const SMS_BADGE_VARIANT: Record<string, 'default' | 'outline' | 'secondary'> = {
  delivered: 'default',
  not_sent: 'outline',
  sent: 'secondary',
  failed: 'secondary',
};

function TruncatedCell({ text, maxLen = 30 }: { text: string | null; maxLen?: number }) {
  if (!text) return null;
  if (text.length <= maxLen) return <Text as="span" className={cls.cell}>{text}</Text>;
  return (
    <Tooltip content={text} side="top">
      <Text as="span" className={cls.cell}>{`${text.slice(0, maxLen)}…`}</Text>
    </Tooltip>
  );
}

interface ColumnsArgs {
  onEdit: (row: IServiceRequest) => void;
  onDelete: (id: number) => void;
}

export const useServiceRequestsTableColumns = ({ onEdit, onDelete }: ColumnsArgs) => {
  const { t } = useTranslation();

  return useMemo<ColumnDef<IServiceRequest>[]>(() => [
    {
      accessorKey: 'request_number',
      header: t('serviceRequests.table.index'),
      size: 120,
      cell: ({ row }) => (
        <Text as="span" className={cls.number}>
          {row.original.request_number || `#${row.original.uid}`}
        </Text>
      ),
    },
    {
      accessorKey: 'call_received_at',
      header: t('serviceRequests.table.date'),
      size: 100,
      cell: ({ row }) => (
        <Text as="span" className={cls.nowrap}>
          {new Date(row.original.call_received_at).toLocaleDateString('ru-RU')}
        </Text>
      ),
    },
    {
      accessorKey: 'operator_name',
      header: t('serviceRequests.table.operator'),
      size: 120,
      cell: ({ row }) => <TruncatedCell text={row.original.operator_name} maxLen={18} />,
    },
    {
      accessorKey: 'counterparty_name',
      header: t('serviceRequests.table.client'),
      size: 150,
      cell: ({ row }) => <TruncatedCell text={row.original.counterparty_name} maxLen={22} />,
    },
    {
      accessorKey: 'account_or_inn',
      header: t('serviceRequests.table.account'),
      size: 120,
      cell: ({ row }) => (
        row.original.account_or_inn
          ? <Text as="span" className={cls.nowrap}>{row.original.account_or_inn}</Text>
          : null
      ),
    },
    {
      accessorKey: 'phone',
      header: t('serviceRequests.table.phone'),
      size: 130,
      cell: ({ row }) => (
        row.original.phone
          ? <Text as="span" className={cls.nowrap}>{row.original.phone}</Text>
          : null
      ),
    },
    {
      accessorKey: 'topic',
      header: t('serviceRequests.table.topic'),
      size: 160,
      cell: ({ row }) => <TruncatedCell text={row.original.topic} maxLen={22} />,
    },
    {
      accessorKey: 'territorial_zone',
      header: t('serviceRequests.table.zone'),
      size: 110,
      cell: ({ row }) => <TruncatedCell text={row.original.territorial_zone} maxLen={16} />,
    },
    {
      accessorKey: 'locality',
      header: t('serviceRequests.table.locality'),
      size: 130,
      cell: ({ row }) => <TruncatedCell text={row.original.locality} maxLen={16} />,
    },
    {
      accessorKey: 'district',
      header: t('serviceRequests.table.district'),
      size: 120,
      cell: ({ row }) => <TruncatedCell text={row.original.district} maxLen={16} />,
    },
    {
      accessorKey: 'address',
      header: t('serviceRequests.table.address'),
      size: 160,
      cell: ({ row }) => <TruncatedCell text={row.original.address} maxLen={22} />,
    },
    {
      accessorKey: 'comment',
      header: t('serviceRequests.table.request'),
      size: 140,
      cell: ({ row }) => <TruncatedCell text={row.original.comment} maxLen={25} />,
    },
    {
      accessorKey: 'schedule_comment',
      header: t('serviceRequests.table.schedule'),
      size: 130,
      cell: ({ row }) => <TruncatedCell text={row.original.schedule_comment} maxLen={20} />,
    },
    {
      accessorKey: 'request_status',
      header: t('serviceRequests.table.status'),
      size: 100,
      cell: ({ row }) => {
        const val = row.original.request_status;
        const opt = REQUEST_STATUS_OPTIONS.find((o) => o.value === val);
        return (
          <Badge variant={STATUS_BADGE_VARIANT[val] || 'outline'}>
            {opt ? t(opt.labelKey, opt.fallback) : val}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'sms_status',
      header: t('serviceRequests.table.sms'),
      size: 90,
      cell: ({ row }) => {
        const val = row.original.sms_status;
        const opt = SMS_STATUS_OPTIONS.find((o) => o.value === val);
        return (
          <Badge variant={SMS_BADGE_VARIANT[val] || 'secondary'}>
            {opt ? t(opt.labelKey, opt.fallback) : val}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: t('common.actions'),
      size: 80,
      cell: ({ row }) => (
        <TableRowActions>
          {row.original.call_uniqueid && (
            <RecordingButton uniqueid={row.original.call_uniqueid} />
          )}
          <TableRowAction
            title={t('common.edit')}
            aria-label={t('common.edit')}
            onClick={() => onEdit(row.original)}
          >
            <Pencil />
          </TableRowAction>
          <TableRowAction
            danger
            title={t('common.delete')}
            aria-label={t('common.delete')}
            onClick={() => onDelete(row.original.uid)}
          >
            <Trash2 />
          </TableRowAction>
        </TableRowActions>
      ),
    },
  ], [t, onEdit, onDelete]);
};

export { STATUS_BADGE_VARIANT, SMS_BADGE_VARIANT };
