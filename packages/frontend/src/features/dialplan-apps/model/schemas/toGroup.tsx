import type { ValueSource } from '@krasterisk/shared';
import type { FieldSchema } from '../schema.types';

type TFn = (...args: [key: string] | [key: string, fallback: string]) => string;

/**
 * Call-group step: same catalog + mask/directory/variable picker as queue and conference.
 * A fixed value is the public group number (`exten`); dynamic sources resolve via
 * `normalizeTarget('group', …)` → `group_{EXTEN}_{tenant}`.
 */
export function readToGroupTarget(
  params: Record<string, unknown> | undefined,
): ValueSource | string | undefined {
  if (!params) return undefined;
  const target = params.target;
  if (target != null && target !== '') return target as ValueSource | string;
  const group = params.group;
  if (group != null && String(group).trim()) return String(group).trim();
  return undefined;
}

export function toGroupFixedKey(params: Record<string, unknown> | undefined): string {
  const target = readToGroupTarget(params);
  if (target && typeof target === 'object' && target.source === 'fixed') {
    return String(target.value ?? '').trim();
  }
  if (typeof target === 'string') return target.trim();
  return '';
}

export function buildToGroupSchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'target',
      kind: 'value-source',
      required: true,
      group: 'primary',
      labelKey: 'routes.chain.fields.group',
      label: t('routes.chain.fields.group', 'Группа вызова'),
      optionsSource: 'callGroups',
      valueSourceMode: 'catalog',
      hintKey: 'routes.chain.togroup.targetHint',
      hint: t(
        'routes.chain.togroup.targetHint',
        '**Группа из списка** — набор и опции Dial берутся из выбранной группы\n**B-номер маршрута** — номер, который набрал абонент, подбирает группу с таким номером\n**Из переменной** — номер группы из переменной канала\n**Из справочника** — номер группы из поля записи\nГруппа должна быть создана заранее в разделе «Группы вызова».',
      ),
    },
  ];
}

export function summarizeToGroup(
  params: Record<string, any>,
  t: (...args: [key: string] | [key: string, fallback: string]) => string,
  refs?: Record<string, unknown>,
): string {
  const raw = readToGroupTarget(params);
  const src = typeof raw === 'object' && raw && 'source' in raw
    ? (raw as ValueSource)
    : raw
      ? ({ source: 'fixed', value: String(raw) } as ValueSource)
      : undefined;
  if (src?.source === 'route_pattern') {
    return t('routes.chain.summary.togroup.routePattern', 'Группа: B-номер маршрута');
  }
  if (src?.source === 'variable') {
    return t('routes.chain.summary.togroup.variable', 'Группа из переменной');
  }
  if (src?.source === 'directory') {
    return t('routes.chain.summary.togroup.directory', 'Группа из справочника');
  }
  const value = src?.source === 'fixed' ? String(src.value ?? '').trim() : '';
  if (value) {
    const catalog = refs?.callGroups as { items?: Array<{ value: string; label: string }> } | undefined;
    const item = catalog?.items?.find((entry) => entry.value === value);
    return t('routes.chain.summary.togroup.fixed', 'Группа {{group}}').replace(
      '{{group}}',
      item?.label ?? value,
    );
  }
  return t('routes.chain.summary.togroup.empty', 'Группа: не выбрана');
}
