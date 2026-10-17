import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Text,
  VStack,
  Button,
} from '@/shared/ui';
import type { ReportColumn } from '@/shared/api/endpoints/callCenterReportsApi';
import { useGetCardByCallQuery, useGetCardTemplatesQuery } from '@/shared/api/endpoints/callCenterApi';
import { ReportCell, reportColumnTitle, type ReportCellContext } from '../../lib/reportCells';
import styles from './CallDetailSheet.module.scss';
import { useGetCdrRecordingQuery } from '@/shared/api/endpoints/cdrApi';
import { buildRecordingPlayUrl } from '@/shared/lib/cdrRecordingUrl';
import { cardAnswerLabel } from '@krasterisk/shared';

export interface CallDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The report row of the call. */
  row: Record<string, unknown> | null;
  columns: readonly ReportColumn[];
  ctx: ReportCellContext;
}

const isFilled = (value: unknown) => value !== null && value !== undefined && value !== '';

function cardValue(value: unknown, yes: string, no: string): string {
  if (Array.isArray(value)) return value.map(item => cardValue(item, yes, no)).join(', ');
  if (typeof value === 'boolean') return value ? yes : no;
  if (value !== null && typeof value === 'object') return 'label' in value ? cardAnswerLabel(value) : JSON.stringify(value);
  return String(value ?? '');
}

/**
 * One call from a report (U3.4): the call path, the recording and the card the operator filled in, so a
 * supervisor goes KPI -> queue -> call -> recording without leaving the reports.
 */
export function CallDetailSheet({ open, onOpenChange, row, columns, ctx }: CallDetailSheetProps) {
  const { t } = useTranslation();
  const uniqueid = row && isFilled(row.callUniqueid) ? String(row.callUniqueid) : '';
  const [playing, setPlaying] = useState(false);
  useEffect(() => setPlaying(false), [uniqueid, open]);
  const recording = useGetCdrRecordingQuery(uniqueid, { skip: !open || !uniqueid });

  const { data: card, isLoading: cardLoading, error: cardError } = useGetCardByCallQuery(uniqueid, {
    skip: !open || !uniqueid,
  });
  const { data: templates } = useGetCardTemplatesQuery(undefined, { skip: !open || !card });

  const fields = useMemo(() => {
    if (!card) return [];
    const template = templates?.find((tpl) => tpl.uid === card.template_id);
    const labels = new Map((template?.fields ?? []).map((f) => [f.field_key, f] as const));
    const yes = t('callcenter.reports.boolYes', 'Yes');
    const no = t('callcenter.reports.boolNo', 'No');
    return Object.entries(card.field_values ?? {})
      .filter(([key, value]) => isFilled(value) && labels.get(key)?.field_type !== 'divider' && labels.get(key)?.field_type !== 'heading')
      .map(([key, value]) => ({ key, label: labels.get(key)?.label ?? key, text: cardValue(value, yes, no) }));
  }, [card, templates, t]);

  const summary = useMemo(
    () => (row ? columns.filter((col) => col.key !== 'callUniqueid' && isFilled(row[col.key])) : []),
    [row, columns],
  );

  const caller = row ? [row.callerIdName, row.callerIdNum].filter(isFilled).join(' ') : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" aria-describedby={undefined} data-testid="cc-call-detail-sheet">
        <SheetHeader>
          <SheetTitle>{caller || t('callcenter.reports.callSheet.title', 'Call')}</SheetTitle>
        </SheetHeader>
        {row ? (
          <VStack gap="16" max className={styles.body}>
            {uniqueid ? (
              <div className={styles.recording}>
                <Text className={styles.sectionTitle}>{t('callcenter.reports.callSheet.recording', 'Recording')}</Text>
                {recording.isLoading ? <Text role="status">{t('common.loading')}</Text>
                  : recording.isError ? <Text role="alert">{t('callcenter.reports.recordingUnavailable', 'Unable to check recording. Check access and try again.')}</Text>
                    : recording.data?.exists ? <>
                      <Button size="sm" variant="outline" onClick={() => setPlaying(!playing)}>{t('recording.play', 'Play recording')}</Button>
                      {playing && <iframe title={t('callcenter.reports.callSheet.recording', 'Recording')} src={buildRecordingPlayUrl(uniqueid) ?? undefined} className={styles.player} />}
                    </> : <Text>{t('callcenter.reports.noRecording', 'No recording for this call')}</Text>}
              </div>
            ) : null}

            <section aria-label={t('callcenter.reports.callSheet.path', 'Call path')}>
              <Text className={styles.sectionTitle}>{t('callcenter.reports.callSheet.path', 'Call path')}</Text>
              <dl className={styles.facts}>
                {summary.map((col) => (
                  <div key={col.key} className={styles.fact}>
                    <dt>{reportColumnTitle(col, ctx.t)}</dt>
                    <dd>
                      <ReportCell col={col} value={row[col.key]} ctx={ctx} />
                    </dd>
                  </div>
                ))}
              </dl>
              {uniqueid ? <Text className={styles.uniqueid}>{uniqueid}</Text> : null}
            </section>

            <section aria-label={t('callcenter.reports.callSheet.card', 'Call card')} data-testid="cc-call-detail-card">
              <Text className={styles.sectionTitle}>{t('callcenter.reports.callSheet.card', 'Call card')}</Text>
              {cardLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : cardError && !('status' in cardError && cardError.status === 404) ? (
                <Text role="alert">{t('callcenter.reports.cardUnavailable', 'Unable to load call card. Check access and try again.')}</Text>
              ) : !card ? (
                <Text className={styles.muted}>{t('callcenter.reports.callSheet.noCard', 'The operator did not fill in a card for this call.')}</Text>
              ) : fields.length === 0 ? (
                <Text className={styles.muted}>{t('callcenter.reports.callSheet.emptyCard', 'The card is empty.')}</Text>
              ) : (
                <dl className={styles.facts}>
                  {fields.map((f) => (
                    <div key={f.key} className={styles.fact}>
                      <dt>{f.label}</dt>
                      <dd>{f.text}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </VStack>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
