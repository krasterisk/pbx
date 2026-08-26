import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

export function buildHangupSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'signal',
      kind: 'choice-cards',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.hangup.signal',
      label: t('routes.chain.hangup.signal', 'Сигнал'),
      options: [
        {
          value: 'busy',
          labelKey: 'routes.chain.hangup.signalBusy',
          label: t('routes.chain.hangup.signalBusy', 'Занято'),
        },
        {
          value: 'congestion',
          labelKey: 'routes.chain.hangup.signalCongestion',
          label: t('routes.chain.hangup.signalCongestion', 'Перегрузка'),
        },
        {
          value: 'hangup',
          labelKey: 'routes.chain.hangup.signalHangup',
          label: t('routes.chain.hangup.signalHangup', 'Разрыв'),
        },
      ],
    },
    {
      key: 'timeout',
      kind: 'duration',
      group: 'params',
      labelKey: 'routes.chain.hangup.timeout',
      label: t('routes.chain.hangup.timeout', 'Длительность сигнала, сек'),
      visibleWhen: { key: 'signal', equals: ['busy', 'congestion'] },
    },
    {
      key: 'causecode',
      kind: 'select',
      group: 'params',
      labelKey: 'routes.chain.hangup.causecode',
      label: t('routes.chain.hangup.causecode', 'Код причины'),
      hintKey: 'routes.apps.hangup.tooltip',
      visibleWhen: { key: 'signal', equals: 'hangup' },
      options: [
        { value: '', labelKey: 'routes.apps.hangup.causeDefault', label: t('routes.apps.hangup.causeDefault', 'Без кода') },
        { value: '16', labelKey: 'routes.apps.hangup.cause16', label: t('routes.apps.hangup.cause16', '16 — нормальное завершение') },
        { value: '17', labelKey: 'routes.apps.hangup.cause17', label: t('routes.apps.hangup.cause17', '17 — абонент занят') },
        { value: '19', labelKey: 'routes.apps.hangup.cause19', label: t('routes.apps.hangup.cause19', '19 — нет ответа') },
        { value: '21', labelKey: 'routes.apps.hangup.cause21', label: t('routes.apps.hangup.cause21', '21 — вызов отклонён') },
      ],
    },
  ];
}

export function summarizeHangup(params: Record<string, unknown>, t: TFn): string {
  const signal = String(params.signal ?? 'hangup');
  if (signal === 'busy') {
    const timeout = String(params.timeout ?? '10');
    return t('routes.chain.hangup.summaryBusy', 'Сигнал «Занято», {{timeout}} сек').replace('{{timeout}}', timeout);
  }
  if (signal === 'congestion') {
    const timeout = String(params.timeout ?? '10');
    return t('routes.chain.hangup.summaryCongestion', 'Сигнал «Перегрузка», {{timeout}} сек').replace('{{timeout}}', timeout);
  }
  const cause = String(params.causecode ?? '').trim();
  return cause
    ? t('routes.chain.hangup.summaryCause', 'Завершить вызов (код {{cause}})').replace('{{cause}}', cause)
    : t('routes.chain.hangup.summary', 'Завершить вызов');
}
