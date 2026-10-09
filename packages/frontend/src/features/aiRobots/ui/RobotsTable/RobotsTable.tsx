import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AiVoiceRobot } from '@krasterisk/shared';
import { Bot, Plus } from 'lucide-react';
import { Button, Text, Input, DataTable, VStack, HStack, Flex } from '@/shared/ui';
import { useGetAiVoiceRobotsQuery } from '@/shared/api/endpoints/aiVoiceRobotsApi';
import { RobotEditor } from '../RobotEditor';
import { useRobotsTableColumns } from './useRobotsTableColumns';
import cls from './RobotsTable.module.scss';

export function RobotsTable() {
  const { t } = useTranslation();
  const { data = [], isLoading, isError, refetch: retryListLoad } = useGetAiVoiceRobotsQuery();
  const [filter, setFilter] = useState('');
  const [editor, setEditor] = useState<{ robot?: AiVoiceRobot; copy?: boolean } | null>(null);
  const edit = useCallback((robot: AiVoiceRobot) => setEditor({ robot }), []);
  const copy = useCallback((robot: AiVoiceRobot) => setEditor({ robot, copy: true }), []);
  const columns = useRobotsTableColumns(edit, copy);
  return <VStack gap="24" max className={cls.page} data-testid="ai-robots-studio">
    <Flex justify="between" align="center" max className={cls.header}>
      <HStack gap="12"><Bot size={24} /><VStack gap="8" align="start">
        <Text variant="h1">{t('aiVoiceDesigner.title')}</Text><Text variant="muted">{t('aiVoiceDesigner.subtitle')}</Text>
      </VStack></HStack>
      <Button className={cls.create} onClick={() => setEditor({})}><Plus size={16} /><Text as="span">{t('aiVoiceDesigner.create')}</Text></Button>
    </Flex>
    <Input aria-label={t('aiVoiceDesigner.search')} placeholder={t('aiVoiceDesigner.search')} value={filter} onChange={event => setFilter(event.target.value)} />
    {isError ? <QueryErrorState message={t('aiVoiceDesigner.loadFailed')} onRetry={() => void retryListLoad()} />
      : isLoading ? <Text>{t('common.loading')}</Text>
        : <Flex max direction="column" align="stretch" className={cls.table} data-hybrid="overflow-x-auto">
          <DataTable columns={columns} data={data} globalFilter={filter} getRowId={row => String(row.uid)} emptyText={t('aiVoiceDesigner.empty')} />
        </Flex>}
    {editor ? <RobotEditor {...editor} onClose={() => setEditor(null)} /> : null}
  </VStack>;
}
