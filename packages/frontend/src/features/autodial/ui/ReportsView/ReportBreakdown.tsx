import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Label, MultiSelect, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetAutodialBasesQuery, useGetAutodialBreakdownQuery, useGetAutodialSelectionQuery, useGetAutodialRecordingMutation,
  type AutodialReportQuery, type AutodialAnalyticsDimension, type AutodialDetailRow } from '@/shared/api/endpoints/autodialApi';
import { autodialDispositionLabel } from '../../lib/labels';
import cls from './ReportsView.module.scss';
import { ReportSelection } from './ReportSelection';

const dimensions: AutodialAnalyticsDimension[] = ['attempt', 'hour', 'heatmap', 'segment', 'hangup', 'operator', 'business_outcome', 'disposition'];
const detailColumns = ['started_at', 'attempt_no', 'disposition', 'billsec', 'trunk_id', 'agent_interface', 'business_outcome', 'dtmf', 'recording'] as const;
export function ReportBreakdown({ query }: { query: AutodialReportQuery }) {
  const { t, i18n } = useTranslation(); const [dimension, setDimension] = useState<AutodialAnalyticsDimension>('attempt');
  const [fieldUid, setFieldUid] = useState<number>(); const [value, setValue] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([...detailColumns]);
  const { data: bases } = useGetAutodialBasesQuery();
  const args = { from: query.from, to: query.to, campaign_uids: query.campaigns, dimension, ...(dimension === 'segment' && fieldUid ? { field_uid: fieldUid } : {}) };
  const { currentData: breakdown, isFetching, isError } = useGetAutodialBreakdownQuery(args, { skip: dimension === 'segment' && !fieldUid });
  const { currentData: selection, isFetching: selecting, isError: selectionFailed } = useGetAutodialSelectionQuery({ ...args, value: value ?? '' }, { skip: value === null });
  const [recording, { isLoading: loadingRecording }] = useGetAutodialRecordingMutation();
  const [audio, setAudio] = useState<string>(); const [audioFailed, setAudioFailed] = useState(false);
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio); }, [audio]);
  const renderCell = (row: AutodialDetailRow, column: string) => {
    if (column === 'started_at') return new Date(row.started_at).toLocaleString(i18n.language, { timeZone: selection?.timezone ?? 'UTC' });
    if (column === 'disposition') return autodialDispositionLabel(row.disposition, t);
    if (column === 'dtmf' || column === 'business_outcome') return String(row.scenario_result?.[column] ?? '—');
    if (column === 'recording') return row.uniqueid ? <Button variant="ghost" disabled={loadingRecording} onClick={async () => {
      setAudioFailed(false); try { const blob = await recording(row.uniqueid!).unwrap(); setAudio(URL.createObjectURL(blob)); } catch { setAudioFailed(true); }
    }}>{t('autodial.workspace.playRecording')}</Button> : '—';
    return String(row[column as keyof AutodialDetailRow] ?? '—');
  };
  return <VStack gap="12" max>
    <HStack gap="12" wrap="wrap" align="end">
      <VStack gap="4"><Label htmlFor="autodial-breakdown-dimension">{t('autodial.workspace.breakdown')}</Label>
        <Select id="autodial-breakdown-dimension" value={dimension} onChange={(event) => { setDimension(event.target.value as AutodialAnalyticsDimension); setValue(null); }}>
          {dimensions.map((item) => <option key={item} value={item}>{t(`autodial.workspace.dimensions.${item}`)}</option>)}</Select></VStack>
      {dimension === 'segment' && <VStack gap="4"><Label htmlFor="autodial-breakdown-field">{t('autodial.workspace.sayField')}</Label>
        <Select id="autodial-breakdown-field" value={fieldUid ?? ''} onChange={(event) => { setFieldUid(Number(event.target.value) || undefined); setValue(null); }}>
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
    </TableRow></TableHeader><TableBody>{breakdown.rows.map((row) => <TableRow key={row.value}>
      <TableCell><Button variant="link" onClick={() => setValue(row.value)}>{dimension === 'disposition' ? autodialDispositionLabel(row.value as AutodialDetailRow['disposition'], t) : row.value}</Button></TableCell>
      <TableCell>{row.dials}</TableCell><TableCell>{row.answered}</TableCell><TableCell>{row.success}</TableCell><TableCell>{row.contact_rate}%</TableCell>
    </TableRow>)}</TableBody></Table></div>}
    {value !== null && <VStack gap="8" max>
      <Text>{t('autodial.workspace.drilldown')}: {value}</Text>
      <ReportSelection key={JSON.stringify({ ...args, value })} filter={{ ...args, value }} />
      <MultiSelect options={detailColumns.map((column) => ({ value: column, label: t(`autodial.workspace.detailColumns.${column}`) }))} value={columns} onChange={setColumns} />
      {(selectionFailed || audioFailed) && <Text role="alert">{t(audioFailed ? 'autodial.workspace.recordingUnavailable' : 'autodial.common.loadFailed')}</Text>}
      {audio && <audio src={audio} controls preload="metadata" aria-label={t('autodial.workspace.playRecording')} />}
      {selecting && <Text role="status">{t('common.loading')}</Text>}
      {selection?.truncated && <Text>{t('autodial.workspace.selectionLimit', { count: selection.limit })}</Text>}
      <div className={cls.tableScroll}><Table showSearch={false} showExport={false}><TableHeader><TableRow>{columns.map((column) => <TableHead key={column}>{t(`autodial.workspace.detailColumns.${column}`)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{(selection?.rows ?? []).map((row) => <TableRow key={row.attempt_uid}>{columns.map((column) => <TableCell key={column}>{renderCell(row, column)}</TableCell>)}</TableRow>)}</TableBody></Table></div>
    </VStack>}
  </VStack>;
}
