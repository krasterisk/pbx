import type { OptionsSource, SchemaCatalogRef } from './schema.types';
import { normalizeTenantDisplayValue } from './normalizeTenantDisplayValue';

type TFn = (...args: [key: string] | [key: string, fallback: string]) => string;

export function summarySlotLabels(slots: readonly { id: string; label?: string }[], t: TFn): Record<string, string> {
  return Object.fromEntries(slots.flatMap(slot => {
    const label = slot.label?.trim()
      ? normalizeTenantDisplayValue(slot.label)
      : t('routes.chain.summaryReference.templateSlot', 'Параметр шаблона');
    return [[slot.id, label], [label, label]];
  }));
}

/** Resolve display labels only. Stored identifiers remain in the action draft. */
export function summaryRefLabel(
  refs: Record<string, unknown> | undefined,
  source: OptionsSource,
  value: unknown,
  t: TFn,
  literalFallback?: string,
): string {
  const raw = String(value ?? '').trim().replace(/^PJSIP\//, '');
  const catalog = refs?.[source] as SchemaCatalogRef | undefined;
  const normalized = normalizeTenantDisplayValue(raw);
  const item = catalog?.items?.find(entry =>
    entry.value === raw || entry.value === normalized || entry.label === raw || entry.aliases?.includes(raw),
  );
  if (item?.label) return item.label;
  const slots = refs?.templateSlotLabels as Record<string, string> | undefined;
  if (slots?.[raw]) return slots[raw];
  if (literalFallback) return literalFallback;
  return catalog?.isLoading
    ? t('routes.chain.summaryReference.loading', 'Загрузка названия')
    : t('routes.chain.summaryReference.unavailable', 'Объект недоступен');
}

export function summaryDirectoryField(
  refs: Record<string, unknown> | undefined,
  directoryUid: unknown,
  fieldUid: unknown,
  t: TFn,
): string {
  const catalog = refs?.dialplanDirectories as SchemaCatalogRef | undefined;
  const directory = catalog?.items?.find(item => item.value === String(directoryUid));
  const field = directory?.fields?.find(item => item.value === String(fieldUid));
  return field?.label || (catalog?.isLoading
    ? t('routes.chain.summaryReference.loading', 'Загрузка названия')
    : t('routes.chain.summaryReference.fieldUnavailable', 'Поле недоступно'));
}
