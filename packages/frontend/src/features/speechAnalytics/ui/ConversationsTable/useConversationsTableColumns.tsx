import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, CheckCircle, Phone, Save, Star } from 'lucide-react';
import { Text } from '@/shared/ui';
import { HStack } from '@/shared/ui/Stack';
import type { SaJournalRow } from '../../api/speechAnalyticsApi';
import { sourceGroup } from './filterJournalRows';
import cls from './ConversationsTable.module.scss';

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '-';
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : '-';
}

export function useConversationsTableColumns(): ColumnDef<SaJournalRow, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => [
    {
      id: 'occurredAt',
      accessorKey: 'occurredAt',
      header: t('speechAnalytics.colOccurred', 'Дата'),
      cell: ({ row }) => <Text>{formatWhen(row.original.occurredAt)}</Text>,
    },
    {
      id: 'operatorName',
      accessorFn: (row) => row.operatorName ?? '',
      header: t('speechAnalytics.colName', 'Имя'),
      cell: ({ row }) => <Text>{dash(row.original.operatorName)}</Text>,
    },
    {
      id: 'callerPhone',
      accessorFn: (row) => row.callerPhone ?? '',
      header: t('speechAnalytics.colCaller', 'Номер'),
      cell: ({ row }) => <Text>{dash(row.original.callerPhone)}</Text>,
    },
    {
      id: 'sourceKind',
      accessorFn: (row) => sourceGroup(row.sourceKind),
      header: t('speechAnalytics.colSource', 'Источник'),
      cell: ({ row }) => {
        const group = sourceGroup(row.original.sourceKind);
        const label = group === 'api'
          ? t('speechAnalytics.sourceApi', 'Аналитика (API)')
          : group === 'upload'
            ? t('speechAnalytics.sourceUpload', 'Аналитика')
            : t('speechAnalytics.sourceCall', 'Звонок');
        const Icon = group === 'pbx' ? Phone : Save;
        return (
          <HStack gap="4" align="center" className={cls.sourceBadge} data-source={group}>
            <Icon size={14} className={cls.sourceIcon} />
            <Text as="span">{label}</Text>
          </HStack>
        );
      },
    },
    {
      id: 'durationMs',
      accessorFn: (row) => row.durationMs ?? 0,
      header: t('speechAnalytics.colDuration', 'Длительность'),
      cell: ({ row }) => <Text>{formatDuration(row.original.durationMs)}</Text>,
    },
    {
      id: 'latestAmount',
      accessorFn: (row) => Number(row.latestAmount ?? 0),
      header: t('speechAnalytics.colCost', 'Стоимость'),
      cell: ({ row }) => (
        <Text>
          {row.original.latestAmount != null
            ? `${row.original.latestAmount} ${row.original.currency ?? ''}`.trim()
            : t('speechAnalytics.costPending', 'Сумма не посчитана')}
        </Text>
      ),
    },
    {
      id: 'score',
      accessorFn: (row) => row.score ?? -1,
      header: t('speechAnalytics.colScore', 'Оценка'),
      cell: ({ row }) => (
        row.original.score != null ? (
          <HStack gap="4" align="center">
            <Star size={14} className={cls.csatStar} />
            <Text>{String(row.original.score)}</Text>
          </HStack>
        ) : <Text>-</Text>
      ),
    },
    {
      id: 'sentiment',
      accessorFn: (row) => row.sentiment ?? '',
      header: t('speechAnalytics.colSentiment', 'Настроение'),
      cell: ({ row }) => (
        <HStack gap="4" align="center">
          {row.original.sentiment ? (
            <Text as="span" className={cls.sentiment} data-sentiment={row.original.sentiment}>
              {row.original.sentiment === 'positive'
                ? t('speechAnalytics.sentimentPositive', 'Позитивное')
                : row.original.sentiment === 'negative'
                  ? t('speechAnalytics.sentimentNegative', 'Негативное')
                  : t('speechAnalytics.sentimentNeutral', 'Нейтральное')}
            </Text>
          ) : <Text>-</Text>}
          {row.original.lowStt ? (
            <Text as="span" className={cls.qualityBadge}>
              {t('speechAnalytics.lowStt', 'Плохое распознавание')}
            </Text>
          ) : null}
        </HStack>
      ),
    },
    {
      id: 'topics',
      accessorFn: (row) => (row.topics ?? []).join(', '),
      header: t('speechAnalytics.colTopics', 'Темы'),
      enableSorting: false,
      cell: ({ row }) => <Text>{(row.original.topics ?? []).join(', ') || '-'}</Text>,
    },
    {
      id: 'success',
      accessorFn: (row) => (row.success == null ? '' : row.success ? '1' : '0'),
      header: t('speechAnalytics.colResult', 'Результат'),
      cell: ({ row }) => {
        if (row.original.success === true) {
          return (
            <HStack gap="4" align="center" className={cls.successText}>
              <CheckCircle size={16} />
              <Text as="span">{t('speechAnalytics.resultSuccess', 'Успех')}</Text>
            </HStack>
          );
        }
        if (row.original.success === false) {
          return (
            <HStack gap="4" align="center" className={cls.escalationText}>
              <AlertCircle size={16} />
              <Text as="span">{t('speechAnalytics.resultEscalation', 'Эскалация')}</Text>
            </HStack>
          );
        }
        return <Text>-</Text>;
      },
    },
  ], [t]);
}
