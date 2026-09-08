import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, DataTable, HStack, TableRowAction, TableRowActions, Text } from '@/shared/ui';
import {
  useDeleteAiProviderMutation,
  useGetAiProvidersQuery,
  type AiCapability,
  type IAiProvider,
} from '@/shared/api/endpoints/aiAgentsApi';
import styles from './AiProvidersTable.module.scss';

interface Props {
  onEdit: (provider: IAiProvider) => void;
}

const CAP_LABEL: Record<AiCapability, string> = {
  llm: 'aiProviders.field.capLlm',
  stt: 'aiProviders.field.capStt',
  tts: 'aiProviders.field.capTts',
  realtime: 'aiProviders.field.capRealtime',
  tools: 'aiProviders.field.capLlm',
  function_calling: 'aiProviders.field.capLlm',
};

const KIND_LABEL: Record<IAiProvider['kind'], string> = {
  online: 'aiProviders.field.kindOnline',
  local: 'aiProviders.field.kindLocal',
  custom: 'aiProviders.field.kindCustom',
};

export function AiProvidersTable({ onEdit }: Props) {
  const { t } = useTranslation();
  const { data: providers = [] } = useGetAiProvidersQuery();
  const [deleteProvider] = useDeleteAiProviderMutation();

  const columns = useMemo<ColumnDef<IAiProvider>[]>(() => [
    {
      accessorKey: 'name',
      header: t('aiAgents.col.name'),
    },
    {
      accessorKey: 'vendor',
      header: t('aiAgents.col.vendor'),
    },
    {
      accessorKey: 'kind',
      header: t('aiAgents.col.kind'),
      cell: ({ row }) => t(KIND_LABEL[row.original.kind]),
    },
    {
      accessorKey: 'capabilities',
      header: t('aiAgents.col.capabilities'),
      cell: ({ row }) => (
        <HStack gap="4" className={styles.caps}>
          {row.original.capabilities.map((cap) => (
            <Text key={cap} className={styles.cap}>
              {t(CAP_LABEL[cap] ?? cap)}
            </Text>
          ))}
        </HStack>
      ),
    },
    {
      accessorKey: 'enabled',
      header: t('aiAgents.col.enabled'),
      cell: ({ row }) => (
        <Text className={row.original.enabled ? styles.statusOn : styles.statusOff}>
          {row.original.enabled ? t('aiProviders.statusOn') : t('aiProviders.statusOff')}
        </Text>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => {
        const provider = row.original;
        return (
          <TableRowActions>
            <TableRowAction
              title={t('common.edit')}
              aria-label={t('common.edit')}
              onClick={() => onEdit(provider)}
            >
              <Pencil />
            </TableRowAction>
            <TableRowAction
              danger
              title={t('common.delete')}
              aria-label={t('common.delete')}
              onClick={() => {
                if (window.confirm(t('aiProviders.confirmDelete', { name: provider.name }))) {
                  void deleteProvider(provider.uid);
                }
              }}
            >
              <Trash2 />
            </TableRowAction>
          </TableRowActions>
        );
      },
    },
  ], [deleteProvider, onEdit, t]);

  return (
    <Card>
      <CardContent className={styles.content}>
        <DataTable
          columns={columns}
          data={providers}
          getRowId={(row) => String(row.uid)}
          emptyText={t('aiProviders.empty')}
          exportFilename="ai_providers"
        />
      </CardContent>
    </Card>
  );
}
