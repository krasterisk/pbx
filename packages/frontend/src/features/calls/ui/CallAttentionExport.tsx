import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CallsQuery } from '@krasterisk/shared';
import { Button, Flex, Text } from '@/shared/ui';
import { useLazyExportCompanyCallsAttentionQuery } from '@/shared/api/endpoints/callsApi';
import { downloadBlob } from '@/shared/lib/downloadBlob';

export function CallAttentionExport({ query }: { query: CallsQuery }) {
  const { t } = useTranslation();
  const [run, {isFetching}] = useLazyExportCompanyCallsAttentionQuery();
  const [error, setError] = useState(false);
  const exportRows = async (format: 'csv' | 'xlsx') => {
    setError(false);
    try { downloadBlob(await run({query,format}).unwrap(), `call-callbacks.${format}`); } catch { setError(true); }
  };
  return <Flex gap="8" align="center" wrap="wrap">
    <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void exportRows('xlsx')}>{t('calls.exportXlsx')}</Button>
    <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void exportRows('csv')}>{t('calls.exportCsv')}</Button>
    {isFetching && <Text role="status">{t('calls.exporting')}</Text>}
    {error && <Text role="alert">{t('calls.exportError')}</Text>}
  </Flex>;
}
