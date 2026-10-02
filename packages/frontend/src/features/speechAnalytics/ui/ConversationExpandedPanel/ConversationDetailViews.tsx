import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle, BarChart3, CheckCircle, MessageSquareText, Smile, Trash2, UserPen,
} from 'lucide-react';
import { Button, Card, CardContent, Input, Select, Text } from '@/shared/ui';
import { AudioPlayer } from '@/shared/ui/AudioPlayer';
import { HStack, VStack } from '@/shared/ui/Stack';
import { formatJournalWhen } from '../ConversationsTable/useConversationsTableColumns';
import type { ConversationMetricResult, ConversationRunCost, ConversationSourceKind } from './ConversationExpandedPanel';
import cls from './ConversationExpandedPanel.module.scss';

const SUMMARY_IDS = new Set(['summary', 'customer_sentiment', 'success', 'csat', 'topics', '_overrides']);

const METRIC_LABELS: Record<string, [string, string]> = {
  greeting_quality: ['speechAnalytics.metricGreeting', 'Качество приветствия'],
  active_listening: ['speechAnalytics.metricListening', 'Активное слушание'],
  objection_handling: ['speechAnalytics.metricObjections', 'Работа с возражениями'],
  product_knowledge: ['speechAnalytics.metricProduct', 'Знание продукта'],
  closing_quality: ['speechAnalytics.metricClosing', 'Качество завершения'],
  script_compliance: ['speechAnalytics.metricScript', 'Следование скрипту'],
  speech_clarity_pace: ['speechAnalytics.metricPace', 'Темп речи'],
  problem_resolution: ['speechAnalytics.metricResolution', 'Решение вопроса'],
  politeness_empathy: ['speechAnalytics.metricPoliteness', 'Вежливость и эмпатия'],
  csat: ['speechAnalytics.metricCsat', 'Удовлетворённость клиента (CSAT)'],
  customer_sentiment: ['speechAnalytics.metricSentimentWhy', 'Эмоциональный настрой клиента'],
  success: ['speechAnalytics.metricSuccessWhy', 'Итог обращения'],
};

const SUMMARY_HINTS: Record<string, [string, string]> = {
  customer_sentiment: ['speechAnalytics.metricSentimentHint', 'Общая тональность речи клиента: позитивная, нейтральная или негативная'],
  success: ['speechAnalytics.metricSuccessHint', 'Был ли решён вопрос клиента'],
  csat: ['speechAnalytics.metricCsatHint', 'CSAT - оценка удовлетворённости клиента по шкале 1-5'],
};

export interface ConversationTurn {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface MetricOverrideRow {
  metricId: string;
  value: string;
  note: string;
}

function labelOf(t: TFunction, id: string): string {
  const pair = METRIC_LABELS[id];
  return pair ? t(pair[0], pair[1]) : id;
}

function isScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function barColor(value: number): string {
  if (value >= 80) return 'var(--color-success)';
  if (value >= 50) return 'var(--color-warning)';
  return 'var(--color-destructive)';
}

function formatTurnTs(ms: number): string | null {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function speakerLabel(t: TFunction, speaker: string): string {
  if (speaker === 'operator') return t('speechAnalytics.speakerOperator', 'Оператор');
  if (speaker === 'customer') return t('speechAnalytics.speakerCustomer', 'Клиент');
  return speaker;
}

function readOverrides(metrics: ConversationMetricResult[]): MetricOverrideRow[] {
  const row = metrics.find((metric) => metric.id === '_overrides');
  if (!Array.isArray(row?.value)) return [];
  return row.value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as { metricId?: unknown; value?: unknown; note?: unknown };
    if (typeof record.metricId !== 'string') return [];
    return [{
      metricId: record.metricId,
      value: String(record.value ?? ''),
      note: String(record.note ?? ''),
    }];
  });
}

function sentimentLabel(t: TFunction, value: unknown): string {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'positive') return t('speechAnalytics.sentimentPositive', 'Позитивное');
  if (raw === 'negative') return t('speechAnalytics.sentimentNegative', 'Негативное');
  if (raw === 'neutral') return t('speechAnalytics.sentimentNeutral', 'Нейтральное');
  return String(value ?? '');
}

export function AnalyticsView({
  summary,
  metricResults,
  canManage,
  onSaveOverride,
  isSavingOverride,
}: {
  summary?: string | null;
  metricResults: ConversationMetricResult[];
  canManage?: boolean;
  onSaveOverride?: (input: { metricId: string; value: string; note: string }) => void;
  isSavingOverride?: boolean;
}) {
  const { t } = useTranslation();
  const byId = useMemo(() => new Map(metricResults.map((row) => [row.id, row])), [metricResults]);
  const sentiment = byId.get('customer_sentiment');
  const success = byId.get('success');
  const csat = byId.get('csat');
  const bars = metricResults.filter((row) => !SUMMARY_IDS.has(row.id) && isScore(row.value));
  const summaryNotes = ['customer_sentiment', 'success', 'csat']
    .map((id) => byId.get(id))
    .filter((row): row is ConversationMetricResult => Boolean(row && (row.rationale || row.quote)));
  const overrides = readOverrides(metricResults);
  const [open, setOpen] = useState(false);
  const [metricId, setMetricId] = useState('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const choices = [
    ...bars.map((row) => row.id),
    ...(csat ? ['csat'] : []),
    ...(sentiment ? ['customer_sentiment'] : []),
    ...(success ? ['success'] : []),
  ];

  return (
    <VStack gap="16" max data-testid="analytics-operator">
      {summary ? (
        <Card className={cls.summaryCard}>
          <CardContent>
            <VStack gap="8" max>
              <HStack gap="8" align="center" className={cls.titleRow}>
                <HStack align="center" justify="center" className={cls.iconWrap}>
                  <MessageSquareText size={18} />
                </HStack>
                <Text variant="h4" as="h3">{t('speechAnalytics.dialogSummary', 'Саммари диалога')}</Text>
              </HStack>
              <Text>{summary}</Text>
            </VStack>
          </CardContent>
        </Card>
      ) : (
        <Text variant="muted">{t('speechAnalytics.emptySummary', 'Нет саммари')}</Text>
      )}

      <HStack gap="8" align="center" className={cls.badgeRow}>
        {sentiment ? (
          <Text as="span" className={cls.sentimentBadge} data-sentiment={String(sentiment.value).toLowerCase()}>
            <Smile size={14} />
            {sentimentLabel(t, sentiment.value)}
          </Text>
        ) : null}
        {success ? (
          <Text as="span" className={cls.successBadge} data-success={String(success.value)}>
            {success.value === true || success.value === 'true'
              ? <CheckCircle size={14} />
              : <AlertCircle size={14} />}
            {success.value === true || success.value === 'true'
              ? t('speechAnalytics.resultSuccess', 'Успех')
              : t('speechAnalytics.resultFailed', 'Неуспешно')}
          </Text>
        ) : null}
        {csat && isScore(csat.value) ? (
          <Text as="span" className={cls.sentimentBadge} data-sentiment="positive">
            {csat.value}
          </Text>
        ) : null}
      </HStack>

      {summaryNotes.length > 0 ? (
        <Card className={cls.detailCard} data-testid="summary-assessments">
          <CardContent>
            <VStack gap="12" max>
              {summaryNotes.map((row) => (
                <VStack key={row.id} gap="4" max>
                  <Text variant="small">{labelOf(t, row.id)}</Text>
                  {SUMMARY_HINTS[row.id] ? (
                    <Text variant="xs" className={cls.hint}>{t(SUMMARY_HINTS[row.id][0], SUMMARY_HINTS[row.id][1])}</Text>
                  ) : null}
                  {row.rationale ? (
                    <Text variant="xs" className={cls.rationale} data-testid={`summary-rationale-${row.id}`}>
                      {row.rationale}
                    </Text>
                  ) : null}
                  {row.quote ? <Text variant="xs" className={cls.quote}>{`«${row.quote}»`}</Text> : null}
                </VStack>
              ))}
            </VStack>
          </CardContent>
        </Card>
      ) : null}

      {bars.length > 0 ? (
        <Card className={cls.detailCard}>
          <CardContent>
            <VStack gap="12" max>
              <HStack gap="8" align="center" className={cls.titleRow}>
                <HStack align="center" justify="center" className={cls.iconWrap}>
                  <BarChart3 size={18} />
                </HStack>
                <Text variant="h4" as="h3">{t('speechAnalytics.operatorScore', 'Оценка оператора')}</Text>
              </HStack>
              {bars.map((row) => (
                <VStack key={row.id} gap="4" max>
                  <HStack justify="between" align="center" max>
                    <Text variant="small">{labelOf(t, row.id)}</Text>
                    <Text variant="small">{String(row.value)}</Text>
                  </HStack>
                  <HStack max className={cls.barTrack} aria-hidden>
                    <HStack
                      className={cls.barFill}
                      style={{ width: `${Math.min(100, Math.max(0, row.value as number))}%`, background: barColor(row.value as number) }}
                    />
                  </HStack>
                  {row.rationale ? <Text variant="xs" className={cls.rationale}>{row.rationale}</Text> : null}
                  {row.quote ? <Text variant="xs" className={cls.quote}>{`«${row.quote}»`}</Text> : null}
                </VStack>
              ))}
            </VStack>
          </CardContent>
        </Card>
      ) : null}

      {canManage && onSaveOverride && choices.length > 0 ? (
        <Card className={cls.detailCard} data-testid="metric-override-panel">
          <CardContent>
            <VStack gap="12" max>
              <HStack justify="between" align="center" max>
                <HStack gap="8" align="center">
                  <HStack align="center" justify="center" className={cls.iconWrap}>
                    <UserPen size={18} />
                  </HStack>
                  <Text variant="h4" as="h3">{t('speechAnalytics.supervisorOverrides', 'Корректировки супервизора')}</Text>
                </HStack>
                <Button type="button" variant="outline" onClick={() => setOpen((current) => !current)}>
                  {open
                    ? t('speechAnalytics.overrideCollapse', 'Свернуть')
                    : t('speechAnalytics.overrideEdit', 'Изменить')}
                </Button>
              </HStack>
              {overrides.map((row) => (
                <HStack key={row.metricId} justify="between" align="start" max>
                  <VStack gap="4">
                    <Text variant="small">{`${labelOf(t, row.metricId)}: ${row.value}`}</Text>
                    {row.note ? <Text variant="xs" className={cls.hint}>{row.note}</Text> : null}
                  </VStack>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={t('common.delete', 'Удалить')}
                    onClick={() => onSaveOverride({ metricId: row.metricId, value: '', note: '' })}
                  >
                    <Trash2 size={16} />
                  </Button>
                </HStack>
              ))}
              {open ? (
                <VStack gap="8" max>
                  <Text variant="xs" className={cls.hint}>
                    {t('speechAnalytics.overrideHint', 'Скорректированные оценки хранятся отдельно от оценок ИИ и используются для калибровки')}
                  </Text>
                  <Select
                    aria-label={t('speechAnalytics.overrideMetric', 'Метрика')}
                    value={metricId}
                    data-testid="override-metric-select"
                    onChange={(event) => { setMetricId(event.target.value); setValue(''); }}
                  >
                    <option value="">{t('speechAnalytics.overridePick', 'Выберите метрику')}</option>
                    {choices.map((id) => (
                      <option key={id} value={id}>{labelOf(t, id)}</option>
                    ))}
                  </Select>
                  {metricId === 'success' ? (
                    <Select aria-label={t('speechAnalytics.overrideValue', 'Значение')} value={value} onChange={(event) => setValue(event.target.value)}>
                      <option value="">{t('speechAnalytics.overridePickValue', 'Выберите значение')}</option>
                      <option value="true">{t('speechAnalytics.yes', 'Да')}</option>
                      <option value="false">{t('speechAnalytics.no', 'Нет')}</option>
                    </Select>
                  ) : null}
                  {metricId === 'customer_sentiment' ? (
                    <Select aria-label={t('speechAnalytics.overrideValue', 'Значение')} value={value} onChange={(event) => setValue(event.target.value)}>
                      <option value="">{t('speechAnalytics.overridePickValue', 'Выберите значение')}</option>
                      <option value="Positive">Positive</option>
                      <option value="Neutral">Neutral</option>
                      <option value="Negative">Negative</option>
                    </Select>
                  ) : null}
                  {metricId && metricId !== 'success' && metricId !== 'customer_sentiment' ? (
                    <Input
                      aria-label={t('speechAnalytics.overrideValue', 'Значение')}
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder={metricId === 'csat' ? '1-5' : '0-100'}
                    />
                  ) : null}
                  {metricId ? (
                    <Input
                      aria-label={t('speechAnalytics.overrideNote', 'Комментарий')}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder={t('speechAnalytics.overrideNote', 'Комментарий (необязательно)')}
                    />
                  ) : null}
                  <Button
                    type="button"
                    disabled={!metricId || !value || isSavingOverride}
                    data-testid="override-save-btn"
                    onClick={() => {
                      onSaveOverride({ metricId, value, note });
                      setMetricId('');
                      setValue('');
                      setNote('');
                    }}
                  >
                    {t('common.save', 'Сохранить')}
                  </Button>
                </VStack>
              ) : null}
            </VStack>
          </CardContent>
        </Card>
      ) : null}
    </VStack>
  );
}

export function TranscriptView({
  sourceKind,
  audioUrl,
  turns,
  transcriptText,
}: {
  sourceKind: ConversationSourceKind;
  audioUrl?: string | null;
  turns: ConversationTurn[];
  transcriptText?: string | null;
}) {
  const { t } = useTranslation();
  const showPlayer = sourceKind === 'upload' || sourceKind === 'api';
  return (
    <VStack gap="16" max>
      {showPlayer ? (
        audioUrl ? <AudioPlayer src={audioUrl} /> : (
          <Text variant="muted" data-testid="conversation-expanded-no-audio">
            {t('speechAnalytics.noAudio', 'Нет аудио')}
          </Text>
        )
      ) : null}
      {turns.length > 0 ? turns.map((turn, index) => {
        const operator = turn.speaker === 'operator';
        const ts = formatTurnTs(turn.startMs);
        return (
          <HStack key={`${turn.startMs}-${index}`} gap="16" align="start" max>
            <VStack gap="4" className={cls.turnMeta}>
              {ts ? <Text variant="xs">{ts}</Text> : null}
              <Text variant="small" className={operator ? cls.speakerOperator : cls.speakerCustomer}>
                {speakerLabel(t, turn.speaker)}
              </Text>
            </VStack>
            <Card className={operator ? cls.turnOperator : cls.turnCustomer}>
              <CardContent>
                <Text>{turn.text}</Text>
              </CardContent>
            </Card>
          </HStack>
        );
      }) : (
        <Card className={cls.detailCard}>
          <CardContent>
            <Text as="pre" className={cls.transcriptText}>
              {transcriptText || t('speechAnalytics.emptyTranscript', 'Нет расшифровки')}
            </Text>
          </CardContent>
        </Card>
      )}
    </VStack>
  );
}

export function BillingView({ runs }: { runs: ConversationRunCost[] }) {
  const { t } = useTranslation();
  if (runs.length === 0) {
    return (
      <Text variant="muted" data-testid="conversation-cost-empty">
        {t('speechAnalytics.emptyCostRuns', 'Прогонов пока нет')}
      </Text>
    );
  }
  return (
    <VStack gap="8" max className={cls.billing} data-testid="conversation-cost-list">
      <HStack max className={cls.billingHead}>
        <Text variant="xs">{t('speechAnalytics.billingIndex', '№')}</Text>
        <Text variant="xs">{t('speechAnalytics.billingTime', 'Время')}</Text>
        <Text variant="xs">{t('speechAnalytics.billingType', 'Тип')}</Text>
        <Text variant="xs">{t('speechAnalytics.billingAudio', 'Аудио, мс')}</Text>
        <Text variant="xs">{t('speechAnalytics.billingTokens', 'Токены LLM')}</Text>
        <Text variant="xs">{t('speechAnalytics.billingTotal', 'Итого')}</Text>
      </HStack>
      {runs.map((run, index) => (
        <HStack
          key={run.id}
          max
          className={cls.billingRow}
          data-testid={`conversation-cost-run-${run.id}`}
        >
          <Text variant="small">{String(index + 1)}</Text>
          <Text variant="small">{formatJournalWhen(run.createdAt)}</Text>
          <Text variant="small">{t('speechAnalytics.billingAnalytic', 'Аналитика')}</Text>
          <Text variant="small">{run.audioMs ?? '-'}</Text>
          <Text variant="small">{run.providerTokens ?? '-'}</Text>
          <VStack gap="4">
            <Text variant="small">
              {run.amount != null
                ? `${run.amount} ${run.currency ?? ''}`.trim()
                : t('speechAnalytics.costPending', 'Сумма не посчитана')}
            </Text>
            <Text variant="xs" className={cls.hint}>
              {t('speechAnalytics.costNotCharged', 'Посчитано, не списано')}
            </Text>
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
}
