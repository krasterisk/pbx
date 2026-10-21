import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Label, MultiSelect, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetAutodialBasesQuery, useGetAutodialBreakdownQuery, useGetAutodialSelectionQuery,
  type AutodialReportQuery, type AutodialAnalyticsDimension, type AutodialDetailRow } from '@/shared/api/endpoints/autodialApi';
import { autodialDispositionLabel } from '../../lib/labels';
import cls from './ReportsView.module.scss';
import { ReportSelection } from './ReportSelection';
import { AttemptInspector } from './AttemptInspector';
import { useReportSearch } from '../../model/useReportSearch';

const dimensions: AutodialAnalyticsDimension[] = ['business_goal', 'business_outcome', 'outcome_category', 'attempt', 'hour', 'heatmap', 'segment', 'hangup', 'operator', 'disposition'];
const detailColumns = ['contact_uid', 'external_id', 'phone', 'tour_no', 'started_at', 'attempt_no', 'disposition', 'billsec', 'trunk_id', 'agent_interface', 'business_outcome', 'dtmf', 'recording'] as const;
export function ReportBreakdown({ query }: { query: AutodialReportQuery }) {
  const { t, i18n } = useTranslation(); const { read, write } = useReportSearch();
  const dimension: AutodialAnalyticsDimension = dimensions.includes(read('dimension') as AutodialAnalyticsDimension) ? read('dimension') as AutodialAnalyticsDimension : 'business_goal';
  const fieldUid = /^[1-9]\d*$/.test(read('field') ?? '') ? Number(read('field')) : undefined;
  const value = read('value');
  const setValue = (next: string | null) => write({ value: next });
  const storedColumns = (read('columns') ?? '').split(',').filter((column) => (detailColumns as readonly string[]).includes(column));
  const columns = storedColumns.length ? [...new Set(storedColumns)] : [...detailColumns];
  const [selectedAttempt, setSelectedAttempt] = useState<AutodialDetailRow | null>(null);
  const groupLabel = (group: string) => dimension === 'business_goal'
    ? t(`autodial.workspace.outcomeDefinition.relations.${['achieved', 'not_achieved'].includes(group) ? group : 'unknown'}`)
    : dimension === 'outcome_category' ? t(`autodial.workspace.outcomeDefinition.categories.${['positive', 'negative', 'callback', 'neutral', 'technical'].includes(group) ? group : 'unknown'}`)
      : dimension === 'disposition' ? autodialDispositionLabel(group as AutodialDetailRow['disposition'], t) : group;
  const { data: bases } = useGetAutodialBasesQuery();
  const args = { from: query.from, to: query.to, campaign_uids: query.campaigns, dimension, ...(dimension === 'segment' && fieldUid ? { field_uid: fieldUid } : {}) };
  const { currentData: breakdown, isFetching, isError } = useGetAutodialBreakdownQuery(args, { skip: dimension === 'segment' && !fieldUid });
  const { currentData: selection, isFetching: selecting, isError: selectionFailed } = useGetAutodialSelectionQuery({ ...args, value: value ?? '' }, { skip: value === null });
  const renderCell = (row: AutodialDetailRow, column: string) => {
    if (column === 'started_at') return new Date(row.started_at).toLocaleString(i18n.language, { timeZone: selection?.timezone ?? 'UTC' });
    if (column === 'disposition') return autodialDispositionLabel(row.disposition, t);
    if (column === 'phone') return row.dialled_phone ?? '—';
    if (column === 'business_outcome') return String(row.scenario_result?.business_outcome_label ?? row.scenario_result?.business_outcome ?? '—');
    if (column === 'dtmf') return String(row.scenario_result?.dtmf ?? '—');
    if (column === 'recording') return <Button variant="outline" onClick={() => setSelectedAttempt(row)}>{t('autodial.workspace.attemptInspector')}</Button>;
    return String(row[column as keyof AutodialDetailRow] ?? '—');
  };
  return <VStack gap="12" max>
    <HStack gap="12" wrap="wrap" align="end">
      <VStack gap="4"><Label htmlFor="autodial-breakdown-dimension">{t('autodial.workspace.breakdown')}</Label>
        <Select id="autodial-breakdown-dimension" value={dimension} onChange={(event) => write({ dimension: event.target.value, value: null })}>
          {dimensions.map((item) => <option key={item} value={item}>{t(`autodial.workspace.dimensions.${item}`)}</option>)}</Select></VStack>
      {dimension === 'segment' && <VStack gap="4"><Label htmlFor="autodial-breakdown-field">{t('autodial.workspace.sayField')}</Label>
        <Select id="autodial-breakdown-field" value={fieldUid ?? ''} onChange={(event) => write({ field: event.target.value || null, value: null })}>
          <option value="">{t('autodial.workspace.chooseField')}</option>
          {(bases ?? []).flatMap((base) => (base.fields ?? []).map((field) => <option key={field.uid} value={field.uid}>{base.name} · {field.label}</option>))}
        </Select></VStack>}
      {breakdown && <Text variant="muted">{t('autodial.workspace.reportTimezone', { timezone: breakdown.timezone })}</Text>}
    </HStack>
    {isError && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
    {isFetching && <Text role="status">{t('common.loading')}</Text>}
    {breakdown?.truncated && <Text>{t('autodial.workspace.breakdownLimit')}</Text>}
    {dimension === 'heatmap' && breakdown && <div className={cls.tableScroll}><Table showSearch={false} showExport={false}>
      <TableHeader><TableRow><TableHead>{t('autodial.workspace.heatmapDay')}</TableHead>{Array.from({ length: 24 }, (_, hour) => <TableHead key={hour}>{hour}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{Array.from({ length: 7 }, (_, day) => <TableRow key={day}><TableCell>{new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 11 + day)))}</TableCell>
        {Array.from({ length: 24 }, (_, hour) => { const key = `${day}:${String(hour).padStart(2, '0')}`, row = breakdown.rows.find((item) => item.value === key);
          return <TableCell key={hour}><Button variant={row?.dials ? 'secondary' : 'ghost'} disabled={!row?.dials} onClick={() => setValue(key)}
            title={`${hour}:00 · ${t('autodial.reports.dials')}: ${row?.dials ?? 0}`}>{row?.dials ?? 0}</Button></TableCell>;
        })}</TableRow>)}</TableBody></Table></div>}
    {breakdown && <div className={cls.tableScroll}><Table showSearch={false} showExport={false}><TableHeader><TableRow>
      <TableHead>{t(`autodial.workspace.dimensions.${dimension}`)}</TableHead><TableHead>{t('autodial.reports.dials')}</TableHead><TableHead>{t('autodial.reports.answered')}</TableHead>
      <TableHead>{t('autodial.reports.success')}</TableHead><TableHead>{t('autodial.reports.contactRate')}</TableHead>
      {['business_outcome', 'business_goal', 'outcome_category'].includes(dimension) && <TableHead>{t('autodial.workspace.metrics.customersWithOutcome')}</TableHead>}
    </TableRow></TableHeader><TableBody>{breakdown.rows.map((row) => <TableRow key={row.value}>
      <TableCell><Button variant="link" onClick={() => setValue(row.value)}>{groupLabel(row.value)}</Button></TableCell>
      <TableCell>{row.dials}</TableCell><TableCell>{row.answered}</TableCell><TableCell>{row.success}</TableCell><TableCell>{row.contact_rate}%</TableCell>
      {['business_outcome', 'business_goal', 'outcome_category'].includes(dimension) && <TableCell>{row.contacts ?? '—'}</TableCell>}
    </TableRow>)}</TableBody></Table></div>}
    {value !== null && <VStack gap="8" max>
      <Text>{t('autodial.workspace.drilldown')}: {groupLabel(value)}</Text>
      <ReportSelection key={JSON.stringify({ ...args, value })} filter={{ ...args, value }} />
      <MultiSelect options={detailColumns.map((column) => ({ value: column, label: t(column === 'phone' ? 'autodial.workspace.dialledPhone' : `autodial.workspace.detailColumns.${column}`) }))} value={columns} onChange={(next) => write({ columns: (next.length ? next : ['started_at']).join(',') })} />
      {selectionFailed && <Text role="alert">{t('autodial.common.loadFailed')}</Text>}
      {selecting && <Text role="status">{t('common.loading')}</Text>}
      {selection?.truncated && <Text>{t('autodial.workspace.selectionLimit', { count: selection.limit })}</Text>}
      <div className={cls.tableScroll}><Table showSearch={false} showExport={false}><TableHeader><TableRow>{columns.map((column) => <TableHead key={column}>{t(column === 'phone' ? 'autodial.workspace.dialledPhone' : `autodial.workspace.detailColumns.${column}`)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{(selection?.rows ?? []).map((row) => <TableRow key={row.attempt_uid}>{columns.map((column) => <TableCell key={column}>{renderCell(row, column)}</TableCell>)}</TableRow>)}</TableBody></Table></div>
    </VStack>}
    <AttemptInspector row={selectedAttempt} timezone={selection?.timezone ?? breakdown?.timezone} onClose={() => setSelectedAttempt(null)} />
  </VStack>;
}
