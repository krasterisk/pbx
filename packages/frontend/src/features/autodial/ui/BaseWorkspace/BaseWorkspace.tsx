import { formatContactValue } from '../../lib/formatContactValue';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Database, Plus, Settings2, Upload } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCard, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@/shared/ui';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { useGetAutodialBaseQuery, useGetAutodialBasesQuery, useGetAutodialContactsQuery, useGetAutodialFieldUsageQuery, useGetAutodialImportProfilesQuery, useGetAutodialImportRunsQuery } from '@/shared/api/endpoints/autodialApi';
import { autodialImportErrorKey } from '../../lib/importError';
import { autodialPageActions } from '../../model/slice/autodialPageSlice';
import { BasesList } from '../BasesList/BasesList';
import { BaseFormModal } from '../BaseFormModal/BaseFormModal';
import { ContactsGrid } from '../ContactsGrid/ContactsGrid';
import { ContactFormModal } from '../ContactFormModal/ContactFormModal';
import { ImportWizard } from '../ImportWizard/ImportWizard';
import { DncPanel } from '../DncPanel/DncPanel';
import { BaseIntegrationGuide } from './BaseIntegrationGuide';
import cls from './BaseWorkspace.module.scss';

const TABS = ['clients', 'fields', 'imports', 'integrations', 'dnc'] as const;
type BaseTab = typeof TABS[number];

function BaseFields({ uid, onEdit }: { uid: number; onEdit: (fieldUid?: number) => void }) {
  const { t, i18n } = useTranslation();
  const { currentData: base } = useGetAutodialBaseQuery(uid);
  const { currentData: usage, isError, refetch } = useGetAutodialFieldUsageQuery(uid);
  const { currentData: sample, isFetching: sampleFetching, isError: sampleError, refetch: refetchSample } = useGetAutodialContactsQuery({ baseUid: uid, pageSize: 1 });
  return <Card><CardHeader><Flex justify="between" align="center" wrap="wrap" gap="12" max>
    <VStack gap="4" align="start"><Text as="h2" variant="h2">{t('autodial.bases.schema')}</Text>
      <Text variant="muted">{t('autodial.workspace.fieldsIntro')}</Text></VStack>
    <Button onClick={() => onEdit()}><Settings2 size={16} />{t('autodial.workspace.editFields')}</Button>
  </Flex></CardHeader><CardContent><VStack gap="8" max align="stretch">
    {isError && <QueryErrorState message={t('autodial.common.loadFailed')} onRetry={() => void refetch()} retryLabel={t('autodial.common.retry')} />}
    {sampleError && <QueryErrorState message={t('autodial.common.loadFailed')} onRetry={() => void refetchSample()} retryLabel={t('autodial.common.retry')} />}
    {[...(base?.fields ?? [])].sort((a, b) => a.position - b.position).map((field) => {
      const example = field.is_phone ? sample?.items[0]?.phones[0]?.normalized : sample?.items[0]?.values[field.key];
      const used = usage?.fields.find((entry) => entry.uid === field.uid)?.used_by;
      return <TableCard key={field.uid} onActivate={() => onEdit(field.uid)} className={cls.fieldCard} max>
        <HStack gap="8" justify="between" wrap="wrap" max>
          <Text>{field.label || field.key}</Text>
          <HStack gap="8" wrap="wrap"><Badge variant="outline">{t(`autodial.bases.fieldTypeLabel.${field.type}`)}</Badge>
            {field.required && <Badge variant="secondary">{t('autodial.bases.required')}</Badge>}</HStack>
        </HStack>
        <Text variant="muted">{t('autodial.workspace.fieldExample')}: {sampleFetching && !sample ? t('common.loading') : formatContactValue(field, example, { locale: i18n.language, yes: t('common.yes'), no: t('common.no'), empty: '—' })}</Text>
        {used && <Text variant="muted">{used.length ? t('autodial.workspace.fieldUsedCount', { count: used.length }) : t('autodial.workspace.notUsed')}</Text>}
      </TableCard>;
    })}
  </VStack></CardContent></Card>;
}

function BaseImports({ uid }: { uid: number }) {
  const { t, i18n } = useTranslation(), dispatch = useAppDispatch();
  const { currentData: profiles, isLoading, isError, refetch } = useGetAutodialImportProfilesQuery(uid);
  const history = useGetAutodialImportRunsQuery(uid);
  return <Card><CardHeader><Text as="h2" variant="h2">{t('autodial.workspace.baseTabs.imports')}</Text></CardHeader>
    <CardContent><VStack gap="12" max align="stretch">
      <Text>{t('autodial.workspace.importWorkspaceHint')}</Text>
      <Button className={cls.compactAction} onClick={() => dispatch(autodialPageActions.openImport())}><Upload size={16} />{t('autodial.import.open')}</Button>
      <Text as="h3" variant="h3">{t('autodial.workspace.importProfiles')}</Text>
      {isError ? <QueryErrorState message={t('autodial.common.loadFailed')} onRetry={() => void refetch()} retryLabel={t('autodial.common.retry')} />
        : isLoading ? <Text role="status">{t('common.loading')}</Text>
          : profiles?.length ? profiles.map((profile) => <Text key={profile.uid}>{profile.name} · {t('autodial.workspace.mappedColumns', { count: profile.column_map.length })}</Text>)
            : <Text variant="muted">{t('autodial.workspace.noImportProfiles')}</Text>}
      <Text as="h3" variant="h3">{t('autodial.workspace.importHistory')}</Text>
      <Text variant="muted">{t('autodial.workspace.importHistoryHint')}</Text>
      {history.isError ? <QueryErrorState message={t('autodial.common.loadFailed')} onRetry={() => void history.refetch()} retryLabel={t('autodial.common.retry')} />
        : history.isLoading ? <Text role="status">{t('common.loading')}</Text>
          : history.currentData?.length ? <Table showSearch={false} showExport={false}><TableHeader><TableRow>
            <TableHead>{t('autodial.workspace.importFile')}</TableHead><TableHead>{t('autodial.workspace.importTime')}</TableHead>
            <TableHead>{t('autodial.workspace.importLoaded')}</TableHead><TableHead>{t('autodial.workspace.importSkipped')}</TableHead>
          </TableRow></TableHeader><TableBody>{history.currentData.map((run) => <TableRow key={run.uid}>
            <TableCell><VStack gap="4" align="start"><Text>{run.filename}</Text>
              {run.errors.length > 0 && <details><summary>{t('autodial.workspace.importErrorCount', { count: run.errors.length })}</summary>
                {run.errors.slice(0, 20).map((error, index) => <Text key={index}>{t('autodial.workspace.importRow', { row: error.row })}: {t(autodialImportErrorKey(error.code))}</Text>)}
              </details>}</VStack></TableCell>
            <TableCell>{run.created_at ? new Date(run.created_at).toLocaleString(i18n.language) : '—'}</TableCell>
            <TableCell>{run.imported}</TableCell><TableCell>{run.skipped}</TableCell>
          </TableRow>)}</TableBody></Table>
            : <Text variant="muted">{t('autodial.workspace.noImportHistory')}</Text>}
    </VStack></CardContent>
  </Card>;
}

export function BaseWorkspace() {
  const { t } = useTranslation(), dispatch = useAppDispatch();
  const [params, setParams] = useSearchParams();
  const rawUid = params.get('base'), parsedUid = Number(rawUid);
  const uid = rawUid && Number.isSafeInteger(parsedUid) && parsedUid > 0 ? parsedUid : null;
  const tab: BaseTab = TABS.includes(params.get('tab') as BaseTab) ? params.get('tab') as BaseTab : 'clients';
  const { currentData: base, isLoading, isError, refetch } = useGetAutodialBaseQuery(uid ?? 0, { skip: uid === null });
  const { currentData: bases } = useGetAutodialBasesQuery();
  const [fieldUid, setFieldUid] = useState<number>();
  useEffect(() => { dispatch(autodialPageActions.selectBase(uid)); }, [dispatch, uid]);
  const open = (next: number, nextTab: BaseTab = 'clients') => setParams({ base: String(next), tab: nextTab });
  const edit = (field?: number) => { if (uid) { setFieldUid(field); dispatch(autodialPageActions.openEditBase(uid)); } };
  return <VStack gap="24" max align="stretch" className={cls.page} data-testid="autodial-bases-page-responsive">
    <Flex justify="between" align="center" wrap="wrap" gap="16" max>
      <HStack gap="12" align="center"><Flex align="center" justify="center" className={cls.iconBadge}><Database size={24} /></Flex>
        <VStack gap="4" align="start"><Text as="h1" variant="h1">{uid ? base?.name ?? t('autodial.bases.pageTitle') : t('autodial.bases.pageTitle')}</Text>
          <Text variant="muted">{uid ? base?.description || t('autodial.workspace.baseWorkspaceHint') : t('autodial.bases.pageSubtitle')}</Text></VStack>
      </HStack>
      {uid ? <Button variant="outline" onClick={() => edit()}><Settings2 size={16} />{t('autodial.workspace.baseProperties')}</Button>
        : <Button data-testid="autodial-create-base" onClick={() => { setFieldUid(undefined); dispatch(autodialPageActions.openCreateBase()); }}><Plus size={16} />{t('autodial.bases.create')}</Button>}
    </Flex>
    {rawUid !== null && <HStack gap="12" wrap="wrap" max>
      <Button variant="ghost" onClick={() => setParams({})}><ArrowLeft size={16} />{t('autodial.workspace.backToBases')}</Button>
      {uid && <Select aria-label={t('autodial.workspace.switchBase')} value={String(uid)} className={cls.baseSwitcher}
        onChange={(event) => open(Number(event.target.value), tab)} options={(bases ?? []).map((item) => ({ value: String(item.uid), label: item.name }))} />}
      {base && <><Badge variant="outline">{t('autodial.bases.contacts', { count: base.contact_count ?? 0 })}</Badge>
        <Text variant="muted">{t('autodial.workspace.baseRevision', { revision: base.revision })}</Text></>}
    </HStack>}
    {rawUid === null ? <BasesList onOpen={open} /> : uid === null ? <Text role="alert">{t('autodial.workspace.invalidBaseLink')}</Text>
      : isError ? <QueryErrorState message={t('autodial.common.loadFailed')} onRetry={() => void refetch()} retryLabel={t('autodial.common.retry')} />
        : isLoading || !base ? <Text role="status">{t('common.loading')}</Text> : <Tabs value={tab} onValueChange={(value) => open(uid, value as BaseTab)} className={cls.tabs}>
          <TabsList className={cls.tabList}>{TABS.map((value) => <TabsTrigger key={value} value={value}>{t(`autodial.workspace.baseTabs.${value}`)}</TabsTrigger>)}</TabsList>
          <TabsContent value="clients"><ContactsGrid key={uid} baseUid={uid} /></TabsContent>
          <TabsContent value="fields"><BaseFields key={uid} uid={uid} onEdit={edit} /></TabsContent>
          <TabsContent value="imports"><BaseImports key={uid} uid={uid} /></TabsContent>
          <TabsContent value="integrations"><BaseIntegrationGuide key={uid} base={base} /></TabsContent>
          <TabsContent value="dnc"><DncPanel scopedAs="base" scopeUid={uid} /></TabsContent>
        </Tabs>}
    <BaseFormModal initialFieldUid={fieldUid} onSaved={(saved) => open(saved, uid === saved ? tab : 'clients')} />
    {uid !== null && <><ContactFormModal key={`contact:${uid}`} baseUid={uid} /><ImportWizard key={`import:${uid}`} baseUid={uid} /></>}
  </VStack>;
}
