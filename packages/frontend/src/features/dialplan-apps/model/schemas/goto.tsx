import type { FieldSchema } from '../schema.types';
import { LabelSelect } from '../../ui/LabelSelect/LabelSelect';
import { GotoConditionField } from '../../ui/GotoConditionField/GotoConditionField';

type TFn = (key: string, fallback?: string) => string;

export function buildGotoSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'label_name',
      kind: 'custom',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.goto.target',
      label: t('routes.chain.goto.target', 'Метка'),
      render: ({ params, onChange, readOnly, field }) => (
        <LabelSelect
          fieldKey={field.key}
          label={t('routes.chain.goto.target', 'Метка')}
          value={String(params.label_name ?? '')}
          readOnly={readOnly}
          onChange={(label_name) => onChange({ label_name })}
        />
      ),
    },
    {
      key: 'condition',
      kind: 'custom',
      group: 'params',
      hideLabel: true,
      labelKey: 'routes.chain.goto.conditional',
      label: t('routes.chain.goto.conditional', 'Условный переход'),
      render: ({ params, onChange, readOnly }) => (
        <GotoConditionField params={params} onChange={onChange} readOnly={readOnly} />
      ),
    },
  ];
}

function hasGotoCondition(params: Record<string, unknown>): boolean {
  const condition = params.condition;
  if (!condition || typeof condition !== 'object') return false;
  const c = condition as Record<string, unknown>;
  return Boolean(c.source || c.dialstatus);
}

export function summarizeGoto(params: Record<string, unknown>, t: TFn): string {
  const name = String(params.label_name ?? '').trim();
  const elseLabel = String(params.false_label ?? '').trim();
  if (hasGotoCondition(params) && name) {
    if (elseLabel) {
      return t('routes.chain.goto.summaryConditionalElse', 'Если условие → {{yes}}, иначе {{no}}')
        .replace('{{yes}}', name)
        .replace('{{no}}', elseLabel);
    }
    return t('routes.chain.goto.summaryConditional', 'Если условие → {{name}}').replace('{{name}}', name);
  }
  return name
    ? t('routes.chain.goto.summary', 'Перейти к метке {{name}}').replace('{{name}}', name)
    : t('routes.chain.goto.summaryEmpty', 'Перейти к метке');
}
