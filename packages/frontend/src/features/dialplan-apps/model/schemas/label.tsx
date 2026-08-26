import type { FieldSchema } from '../schema.types';

type TFn = (key: string, fallback?: string) => string;

/** Matches backend LabelParamsDto @Matches(SAFE_DIAL). */
export const SAFE_LABEL_NAME = /^[^(),?\[\]{}$\\";\n\r]*$/;

export function labelFieldErrors(params: Record<string, unknown>): Record<string, string> {
  const name = String(params.label_name ?? '').trim();
  if (!name) return { label_name: 'required' };
  if (!SAFE_LABEL_NAME.test(name)) return { label_name: 'invalid' };
  return {};
}

export function buildLabelSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'label_name',
      kind: 'text',
      required: true,
      labelKey: 'routes.chain.label.name',
      label: t('routes.chain.label.name', 'Имя метки'),
      hintKey: 'routes.chain.label.nameHint',
      hint: t(
        'routes.chain.label.nameHint',
        'Латиница, цифры, _ и -. Без скобок и пробелов — имя используется в dialplan как метка перехода.',
      ),
    },
  ];
}

export function summarizeLabel(params: Record<string, unknown>, t: TFn): string {
  const name = String(params.label_name ?? '').trim();
  return name
    ? t('routes.chain.label.summary', 'Метка {{name}}').replace('{{name}}', name)
    : t('routes.chain.label.summaryEmpty', 'Метка без имени');
}