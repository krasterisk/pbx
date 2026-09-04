import { useTranslation } from 'react-i18next';
import type { TemplateSlotKind } from '@krasterisk/shared';
import { Label, Select, Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useSchemaRefs } from '@/features/dialplan-apps/model/useSchemaRefs';
import {
  SLOT_KIND_LABEL_FALLBACK,
  SLOT_KIND_LABEL_KEY,
  SLOT_KIND_SOURCE,
} from '../../model/slotCatalog';
import styles from './SlotSelect.module.scss';

export interface SlotSelectProps {
  kind: TemplateSlotKind;
  slotId?: string;
  label?: string;
  value: string;
  onChange: (next: { uid: string; name: string }) => void;
}

export function SlotSelect({ kind, slotId, label, value, onChange }: SlotSelectProps) {
  const { t } = useTranslation();
  const source = SLOT_KIND_SOURCE[kind];
  const refs = useSchemaRefs([source]);
  const catalog = refs[source];
  const fieldId = `template-slot-${slotId || kind}`;
  const fieldLabel = label
    || t(SLOT_KIND_LABEL_KEY[kind], SLOT_KIND_LABEL_FALLBACK[kind]);
  const loading = catalog?.isLoading ?? false;
  const items = catalog?.items ?? [];
  const empty = !loading && items.length === 0;
  const loadingLabel = t('routes.chain.catalog.loading', 'Загружаем список');
  const emptyLabel = t('routes.chain.catalog.empty', 'Ничего не создано');
  const sectionName = t(
    catalog?.sectionKey ?? 'routes.chain.catalog.queuesSection',
    catalog?.sectionFallback ?? 'Очереди',
  );
  const placeholder = loading ? loadingLabel : empty ? emptyLabel : t('routes.chain.catalog.choose', 'Выберите');

  return (
    <VStack gap="8" max>
      <HStack gap="4" align="center">
        <Label htmlFor={fieldId}>{fieldLabel}</Label>
        <InfoTooltip text={t('routes.templates.fillHint', 'Шаблон не привязан к конкретной очереди, выберите свою')} />
      </HStack>
      <Select
        id={fieldId}
        disabled={loading || empty}
        value={value}
        aria-label={loading ? loadingLabel : empty ? emptyLabel : fieldLabel}
        onChange={(e) => {
          const next = items.find((item) => item.value === e.target.value);
          onChange({ uid: e.target.value, name: next?.value ?? e.target.value });
        }}
      >
        <option value="">{placeholder}</option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </Select>
      {empty ? (
        <>
          <Text variant="muted">
            {t('routes.chain.catalog.emptyHint', 'Сначала создайте запись в разделе «{{section}}»').replace(
              '{{section}}',
              sectionName,
            )}
          </Text>
          <a
            href={catalog?.sectionHref ?? '/queues'}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.catalogLink}
          >
            {t('routes.chain.catalog.openSection', 'Открыть раздел «{{section}}»').replace(
              '{{section}}',
              sectionName,
            )}
          </a>
        </>
      ) : null}
    </VStack>
  );
}
