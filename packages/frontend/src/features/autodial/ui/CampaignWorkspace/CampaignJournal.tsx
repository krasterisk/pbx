import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useGetAutodialJournalQuery } from '@/shared/api/endpoints/autodialApi';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { aiChatActions } from '@/features/ai-chat/model/slice/aiChatSlice';

export function CampaignJournal({ uid }: { uid: number }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [cursor, setCursor] = useState<number>();
  const { currentData: rows, isFetching, isError } = useGetAutodialJournalQuery({ uid, before: cursor }, { pollingInterval: cursor ? 0 : 15000 });
  return <VStack gap="12" max>
    {isError && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
    <Table showSearch={false} showExport={false}><TableHeader><TableRow>
      <TableHead>{t('autodial.workspace.eventTime')}</TableHead><TableHead>{t('autodial.workspace.event')}</TableHead>
      <TableHead>{t('autodial.workspace.tour')}</TableHead><TableHead>{t('autodial.workspace.eventRevision')}</TableHead>
      <TableHead>{t('autodial.workspace.eventActor')}</TableHead>
    </TableRow></TableHeader><TableBody>{(rows ?? []).map((row) => <TableRow key={row.uid}>
      <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
      <TableCell>{t(`autodial.workspace.events.${row.event_type}`, { defaultValue: row.event_type })}</TableCell>
      <TableCell>{row.tour_no}</TableCell><TableCell>{row.revision}</TableCell>
      <TableCell>{row.payload?.actor_source === 'ai_assistant' ? 'AI · ' : ''}{typeof row.payload?.actor_uid === 'number' ? `#${row.payload.actor_uid}` : t('autodial.workspace.systemActor')}
        {typeof row.payload?.thread_uid === 'number' && row.payload.thread_uid > 0 && <Button variant="link" onClick={() => dispatch(aiChatActions.openThread(Number(row.payload?.thread_uid)))}>
          {t('autodial.workspace.openAiThread', { uid: row.payload.thread_uid })}</Button>}
      </TableCell>
    </TableRow>)}</TableBody></Table>
    {!rows?.length && !isFetching && <Text>{t('autodial.workspace.noEvents')}</Text>}
    <Button variant="outline" disabled={isFetching || (rows?.length ?? 0) < 100} onClick={() => setCursor(rows?.at(-1)?.uid)}>{t('autodial.workspace.older')}</Button>
    {cursor && <Button variant="outline" onClick={() => setCursor(undefined)}>{t('autodial.workspace.latest')}</Button>}
  </VStack>;
}
