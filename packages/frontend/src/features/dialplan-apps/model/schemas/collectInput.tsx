import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

export function buildCollectInputSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'variableName',
      kind: 'text',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.collect.variable',
      label: t('routes.chain.collect.variable', 'Имя переменной'),
      hintKey: 'routes.chain.collect.variableHint',
      hint: t(
        'routes.chain.collect.variableHint',
        'Имя переменной канала, куда сохранится ввод. Её можно проверить в условии следующего шага «Переход».',
      ),
    },
    {
      key: 'mode',
      kind: 'mode',
      group: 'primary',
      labelKey: 'routes.chain.collect.mode',
      label: t('routes.chain.collect.mode', 'Что собираем'),
      options: [
        { value: 'digits', labelKey: 'routes.chain.collect.modeDigits', label: t('routes.chain.collect.modeDigits', 'Цифры') },
        { value: 'extension', labelKey: 'routes.chain.collect.modeExten', label: t('routes.chain.collect.modeExten', 'Ожидание extension') },
      ],
    },
    {
      key: 'promptFile',
      kind: 'select',
      group: 'primary',
      labelKey: 'routes.chain.collect.prompt',
      label: t('routes.chain.collect.prompt', 'Запись с вопросом'),
      optionsSource: 'prompts',
    },
    {
      key: 'digitsCount',
      kind: 'number',
      required: true,
      group: 'params',
      labelKey: 'routes.chain.collect.digits',
      label: t('routes.chain.collect.digits', 'Число цифр'),
      visibleWhen: { key: 'mode', equals: 'digits' },
    },
    {
      key: 'timeout',
      kind: 'duration',
      required: true,
      group: 'params',
      labelKey: 'routes.chain.collect.timeout',
      label: t('routes.chain.collect.timeout', 'Таймаут, сек'),
    },
    {
      key: 'attempts',
      kind: 'number',
      group: 'params',
      labelKey: 'routes.chain.collect.attempts',
      label: t('routes.chain.collect.attempts', 'Число попыток'),
      visibleWhen: { key: 'mode', equals: 'digits' },
    },
  ];
}

export function summarizeCollectInput(params: Record<string, unknown>, t: TFn): string {
  const variable = String(params.variableName ?? '').trim() || '…';
  if (params.mode === 'extension') {
    return t('routes.chain.collect.summaryExten', 'Запросить extension в {{variable}}').replace('{{variable}}', variable);
  }
  const digits = String(params.digitsCount ?? '');
  return t('routes.chain.collect.summary', 'Запросить {{digits}} цифр в {{variable}}')
    .replace('{{digits}}', digits || '1')
    .replace('{{variable}}', variable);
}
