import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, Cable } from 'lucide-react';
import { Card, CardHeader, CardContent, Input } from '@/shared/ui';
import { HStack, Flex } from '@/shared/ui/Stack';
import { useGetTrunksQuery } from '@/shared/api/endpoints/trunkApi';
import type { ITrunkListItem } from '@/shared/api/endpoints/trunkApi';
import { DataTable } from '@/shared/ui';
import { useTrunksTableColumns } from './useTrunksTableColumns';

export const TrunksTable = memo(() => {
  const { t } = useTranslation();
  const { data: trunks = [], isLoading } = useGetTrunksQuery();
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useTrunksTableColumns();

  const registeredCount = trunks.filter(
    (tr) => tr.registrationStatus === 'Registered',
  ).length;

  return (
    <Card>
      <CardHeader>
        <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
          <HStack gap="8" align="center">
            <Cable className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">
              {t('trunks.count', { count: trunks.length })}
            </span>
            {trunks.length > 0 && (
              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                {registeredCount} {t('trunks.statusRegistered', 'Registered').toLowerCase()}
              </span>
            )}
          </HStack>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="trunks-search"
              placeholder={t('common.search')}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
        </HStack>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <Flex align="center" justify="center" className="h-48">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </Flex>
        ) : (
          <DataTable
            data={trunks as ITrunkListItem[]}
            columns={columns}
            getRowId={(row) => row.id}
            globalFilter={globalFilter}
            pageSize={25}
            emptyText={t('common.noData')}
          />
        )}
      </CardContent>
    </Card>
  );
});

TrunksTable.displayName = 'TrunksTable';
