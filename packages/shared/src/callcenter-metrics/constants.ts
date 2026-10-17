/**
 * Call-center metrics dictionary — constants (cc-analytics, phase A1).
 * One source of truth for the live engine, raw reports, rollup, alerts and wallboard.
 */

/** Industry-standard 80/20 default; per-queue `servicelevel` overrides. */
export const DEFAULT_SLA_THRESHOLD_SEC = 20;

/** Abandon within this many seconds is "short" and excluded from the offered denominator (R2). */
export const DEFAULT_SHORT_ABANDON_SEC = 5;

/** Allowed tenant range for `short_abandon_sec`. 0 disables short-abandon exclusion. */
export const MIN_SHORT_ABANDON_SEC = 0;
export const MAX_SHORT_ABANDON_SEC = 60;

/** Pseudo-queue prefix used for personal/direct calls (`direct:<interface>`); never a real queue. */
export const DIRECT_QUEUE_PREFIX = 'direct:';

/** Only inbound rows of real queues are queue calls. Missing direction defaults to inbound (DB default). */
export const QUEUE_CALL_DIRECTION = 'inbound';

export const QUEUE_DISPOSITIONS_HANDLED = ['answered', 'transferred'] as const;
export const QUEUE_DISPOSITIONS_ABANDONED = ['abandoned', 'timeout'] as const;

export type CcMetricId =
  | 'offered'
  | 'handled'
  | 'sla'
  | 'abandon'
  | 'shortAbandon'
  | 'asa'
  | 'aht'
  | 'occupancy';

export interface CcMetricDefinition {
  id: CcMetricId;
  unit: 'count' | 'percent' | 'duration';
  direction: 'higherIsBetter' | 'lowerIsBetter' | 'neutral';
  /** I18n key suffix under `callcenter.metrics.<key>`. */
  i18nKey: string;
  formulaEn: string;
  formulaRu: string;
}

export const CC_METRIC_DEFINITIONS: Record<CcMetricId, CcMetricDefinition> = {
  offered: {
    id: 'offered',
    unit: 'count',
    direction: 'neutral',
    i18nKey: 'offered',
    formulaEn: 'Unique inbound queue calls (ring-no-answer attempts are not counted twice).',
    formulaRu: 'Уникальные входящие звонки в очередь (попытки дозвона операторам не дублируются).',
  },
  handled: {
    id: 'handled',
    unit: 'count',
    direction: 'neutral',
    i18nKey: 'handled',
    formulaEn: 'Answered + transferred after answer.',
    formulaRu: 'Отвеченные звонки и звонки, переведённые после ответа оператора.',
  },
  sla: {
    id: 'sla',
    unit: 'percent',
    direction: 'higherIsBetter',
    i18nKey: 'sla',
    formulaEn: 'Handled within queue service level threshold ÷ (offered − short abandons).',
    formulaRu: 'Обслужено в пределах порога очереди ÷ (поступило − короткие сбросы).',
  },
  abandon: {
    id: 'abandon',
    unit: 'percent',
    direction: 'lowerIsBetter',
    i18nKey: 'abandon',
    formulaEn: 'Caller abandons after short_abandon_sec ÷ (offered − short abandons).',
    formulaRu: 'Сбросы после порога короткого сброса ÷ (поступило − короткие сбросы).',
  },
  shortAbandon: {
    id: 'shortAbandon',
    unit: 'count',
    direction: 'neutral',
    i18nKey: 'shortAbandon',
    formulaEn: 'Caller hung up within short_abandon_sec (default 5 s); excluded from SLA and abandon rate.',
    formulaRu: 'Абонент положил трубку быстрее порога короткого сброса (по умолчанию 5 с); не входит в расчёт SLA и потерь.',
  },
  asa: {
    id: 'asa',
    unit: 'duration',
    direction: 'lowerIsBetter',
    i18nKey: 'asa',
    formulaEn: 'Average speed of answer = total wait time of handled calls ÷ handled calls.',
    formulaRu: 'Среднее время ожидания ответа = сумма ожидания обслуженных звонков ÷ обслужено.',
  },
  aht: {
    id: 'aht',
    unit: 'duration',
    direction: 'lowerIsBetter',
    i18nKey: 'aht',
    formulaEn: 'Average handle time = (talk time including hold + wrap-up) ÷ handled calls.',
    formulaRu: 'Среднее время обработки = (разговор с удержанием + постобработка) ÷ обслужено.',
  },
  occupancy: {
    id: 'occupancy',
    unit: 'percent',
    direction: 'neutral',
    i18nKey: 'occupancy',
    formulaEn: '(Talk + wrap-up) ÷ (talk + wrap-up + ready idle time).',
    formulaRu: '(Разговор + постобработка) ÷ (разговор + постобработка + ожидание звонка).',
  },
};
