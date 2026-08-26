import { useTranslation } from 'react-i18next';
import { Button, Input, Label, Select, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { Plus, Trash2 } from 'lucide-react';
import { useGetTrunksQuery } from '@/shared/api/endpoints/trunkApi';
import { useGetPhonebooksQuery } from '@/shared/api/endpoints/phonebookApi';
import type { ITrunkCarouselItem } from '@krasterisk/shared';
import styles from './TrunkCarouselTrunksField.module.scss';

const DEFAULT_TRUNK_TIMEOUT = 60;

export function TrunkCarouselTrunksField({
  params,
  onChange,
  readOnly,
}: {
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { data: trunks = [], isLoading: trunksLoading } = useGetTrunksQuery();
  const { data: phonebooks = [], isLoading: phonebooksLoading } = useGetPhonebooksQuery();
  const items: ITrunkCarouselItem[] = Array.isArray(params.trunks) ? params.trunks : [];
  const hint = t(
    'routes.apps.trunkCarousel.hint',
    'Сначала выбирает случайный транк, при недозвоне проходит по упорядоченному списку. Для каждого транка CallerID - статичный номер или справочник.',
  );

  const patchItems = (next: ITrunkCarouselItem[]) => onChange({ trunks: next });

  const addRow = () =>
    patchItems([
      ...items,
      { trunk: '', cid_mode: 'static', callerid: '', timeout: DEFAULT_TRUNK_TIMEOUT },
    ]);

  const updateRow = (index: number, patch: Partial<ITrunkCarouselItem>) => {
    const next = items.map((row, i) => (i === index ? { ...row, ...patch } : row));
    patchItems(next);
  };

  const removeRow = (index: number) => patchItems(items.filter((_, i) => i !== index));

  return (
    <VStack gap="12" max className={styles.container}>
      {items.map((row, index) => {
        const cidMode = row.cid_mode ?? 'static';
        return (
          <VStack key={`trunk-row-${index}`} gap="8" max className={styles.trunkCard}>
            <HStack gap="8" align="end" max className={styles.trunkRow}>
              <VStack gap="4" className={styles.trunkSelect}>
                <HStack gap="4" align="center">
                  <Label>{t('routes.apps.trunkCarousel.selectTrunk', 'Транк')}</Label>
                  {index === 0 ? <InfoTooltip text={hint} /> : null}
                </HStack>
                <Select
                  disabled={readOnly || trunksLoading}
                  value={row.trunk}
                  aria-label={t('routes.apps.trunkCarousel.selectTrunk', 'Транк')}
                  onChange={(e) => updateRow(index, { trunk: e.target.value })}
                >
                  <option value="">{t('routes.apps.trunkCarousel.selectTrunkOption', 'Выберите транк')}</option>
                  {trunks.map((trunk) => (
                    <option key={trunk.name} value={trunk.name}>
                      {trunk.name}
                    </option>
                  ))}
                </Select>
              </VStack>
              <VStack gap="4" className={styles.timeoutCol}>
                <Label>{t('routes.chain.fields.timeout', 'Таймаут, сек')}</Label>
                <Input
                  type="number"
                  disabled={readOnly}
                  value={row.timeout ?? DEFAULT_TRUNK_TIMEOUT}
                  aria-label={t('routes.chain.fields.timeout', 'Таймаут, сек')}
                  onChange={(e) =>
                    updateRow(index, {
                      timeout:
                        e.target.value === ''
                          ? DEFAULT_TRUNK_TIMEOUT
                          : Number(e.target.value) || DEFAULT_TRUNK_TIMEOUT,
                    })
                  }
                />
              </VStack>
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeRow(index)}
                  aria-label={t('routes.apps.trunkCarousel.removeTrunk', 'Удалить транк')}
                >
                  <Trash2 size={16} />
                </Button>
              ) : null}
            </HStack>
            <HStack gap="8" align="end" max className={styles.cidRow}>
              <VStack gap="4" className={styles.cidModeCol}>
                <Label>{t('routes.apps.trunkCarousel.cidMode', 'Источник CID')}</Label>
                <Select
                  disabled={readOnly}
                  value={cidMode}
                  aria-label={t('routes.apps.trunkCarousel.cidMode', 'Источник CID')}
                  onChange={(e) =>
                    updateRow(index, {
                      cid_mode: e.target.value === 'phonebook' ? 'phonebook' : 'static',
                    })
                  }
                >
                  <option value="static">{t('routes.apps.trunkCarousel.cidStatic', 'Статичный CID')}</option>
                  <option value="phonebook">{t('routes.apps.trunkCarousel.cidPhonebook', 'CID из справочника')}</option>
                </Select>
              </VStack>
              {cidMode === 'phonebook' ? (
                <VStack gap="4" className={styles.cidValueCol}>
                  <Label>{t('routes.apps.trunkCarousel.selectPhonebook', 'Справочник')}</Label>
                  <Select
                    disabled={readOnly || phonebooksLoading}
                    value={row.phonebook_uid ? String(row.phonebook_uid) : ''}
                    aria-label={t('routes.apps.trunkCarousel.selectPhonebook', 'Справочник')}
                    onChange={(e) =>
                      updateRow(index, {
                        phonebook_uid: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  >
                    <option value="">{t('routes.apps.trunkCarousel.selectPhonebookOption', 'Выберите справочник')}</option>
                    {phonebooks.map((pb) => (
                      <option key={pb.uid} value={String(pb.uid)}>
                        {pb.name}
                      </option>
                    ))}
                  </Select>
                </VStack>
              ) : (
                <VStack gap="4" className={styles.cidValueCol}>
                  <Label>{t('routes.apps.trunkCarousel.callerid', 'Номер CallerID (опц.)')}</Label>
                  <Input
                    disabled={readOnly}
                    value={row.callerid ?? ''}
                    placeholder="79001234567"
                    aria-label={t('routes.apps.trunkCarousel.callerid', 'Номер CallerID')}
                    onChange={(e) => updateRow(index, { callerid: e.target.value })}
                  />
                </VStack>
              )}
            </HStack>
          </VStack>
        );
      })}
      {!readOnly ? (
        <Button type="button" variant="outline" onClick={addRow}>
          <Plus size={16} />
          {t('routes.apps.trunkCarousel.addTrunk', 'Добавить транк')}
        </Button>
      ) : null}
    </VStack>
  );
}
