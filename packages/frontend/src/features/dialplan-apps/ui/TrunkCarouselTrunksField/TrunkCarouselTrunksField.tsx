import { useTranslation } from 'react-i18next';
import type { ITrunkCarouselItem, TrunkCallerIdSource } from '@krasterisk/shared';
import { Button, Input, Label, Select, Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { Plus, Trash2 } from 'lucide-react';
import { useGetTrunksQuery } from '@/shared/api/endpoints/trunkApi';
import { useGetDirectoryQuery } from '@/shared/api/endpoints/directoryApi';
import { useSchemaRefs } from '../../model/useSchemaRefs';
import styles from './TrunkCarouselTrunksField.module.scss';

const DEFAULT_TRUNK_TIMEOUT = 60;

type DirectoryCallerId = Extract<TrunkCallerIdSource, { mode: 'directory' }>;

function isDirectoryCaller(value: TrunkCallerIdSource | undefined): value is DirectoryCallerId {
  return value?.mode === 'directory';
}

function emptyStaticItem(): ITrunkCarouselItem {
  return {
    trunkId: '',
    callerId: { mode: 'static', value: '' },
    timeout: DEFAULT_TRUNK_TIMEOUT,
  };
}

export function TrunkDirectoryCidField({
  value,
  onChange,
  readOnly,
}: {
  value: DirectoryCallerId | undefined;
  onChange: (next: DirectoryCallerId) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const refs = useSchemaRefs(['dialplanDirectories']);
  const directories = refs.dialplanDirectories?.items ?? [];
  const directoryUid = value?.directoryUid ?? 0;
  const query = useGetDirectoryQuery(directoryUid, { skip: directoryUid <= 0 });
  const fields = (query.data?.fields ?? []).filter(
    (field) => field.type === 'phone' || field.uid === value?.valueFieldUid,
  );

  const emit = (patch: Partial<DirectoryCallerId>) => {
    onChange({
      mode: 'directory',
      directoryUid: patch.directoryUid ?? directoryUid,
      valueFieldUid: patch.valueFieldUid ?? value?.valueFieldUid ?? 0,
      keySource: { source: 'original_caller' },
      onMissing: 'keep_original',
    });
  };

  const directoryLabel = t('routes.apps.trunkCarousel.selectDirectory', 'Справочник');
  const fieldLabel = t('routes.chain.directoryLookup.selectField', 'Поле записи');

  return (
    <VStack gap="8" max className={styles.cidValueCol}>
      <VStack gap="4" max>
        <Label>{directoryLabel}</Label>
        <Select
          disabled={readOnly || refs.dialplanDirectories?.isLoading}
          value={directoryUid ? String(directoryUid) : ''}
          aria-label={directoryLabel}
          onChange={(e) => emit({ directoryUid: Number(e.target.value) || 0, valueFieldUid: 0 })}
        >
          <option value="">{t('routes.apps.trunkCarousel.selectDirectoryOption', 'Выберите справочник')}</option>
          {directories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
      </VStack>
      {directoryUid > 0 ? (
        <VStack gap="4" max>
          <Label>{fieldLabel}</Label>
          <Select
            disabled={readOnly || query.isLoading}
            value={value?.valueFieldUid ? String(value.valueFieldUid) : ''}
            aria-label={fieldLabel}
            onChange={(e) => emit({ valueFieldUid: Number(e.target.value) || 0 })}
          >
            <option value="">{t('routes.chain.source.selectVarKeyPlaceholder', 'Выберите поле')}</option>
            {fields.map((field) => (
              <option key={field.uid} value={String(field.uid)}>
                {field.label}
              </option>
            ))}
          </Select>
        </VStack>
      ) : null}
      <VStack gap="4" max className={styles.cidHint}>
        <Text variant="small">
          {t('routes.apps.trunkCarousel.directoryKeyHint', 'Ключ поиска: исходный CallerID')}
        </Text>
        <Text variant="small">
          {t('routes.apps.trunkCarousel.directoryMissingHint', 'Если данных нет: сохранить исходный CallerID')}
        </Text>
      </VStack>
    </VStack>
  );
}

export function TrunkSingleCidField({
  params,
  onChange,
  readOnly,
}: {
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const callerId = params.callerId as TrunkCallerIdSource | undefined;
  const directoryMode = isDirectoryCaller(callerId);
  const staticValue = !directoryMode
    ? (callerId?.mode === 'static' ? callerId.value : String(params.callerid ?? ''))
    : '';

  return (
    <HStack gap="8" align="end" max className={styles.cidRow}>
      <VStack gap="4" className={styles.cidModeCol}>
        <Label>{t('routes.apps.trunkCarousel.cidMode', 'Источник CID')}</Label>
        <Select
          disabled={readOnly}
          value={directoryMode ? 'directory' : 'static'}
          aria-label={t('routes.apps.trunkCarousel.cidMode', 'Источник CID')}
          onChange={(e) => {
            if (e.target.value === 'directory') {
              onChange({
                callerid: undefined,
                callerId: {
                  mode: 'directory',
                  directoryUid: 0,
                  valueFieldUid: 0,
                  keySource: { source: 'original_caller' },
                  onMissing: 'keep_original',
                },
              });
              return;
            }
            onChange({
              callerid: staticValue ?? '',
              callerId: { mode: 'static', value: staticValue ?? '' },
            });
          }}
        >
          <option value="static">{t('routes.apps.trunkCarousel.cidStatic', 'Статичный CID')}</option>
          <option value="directory">{t('routes.apps.trunkCarousel.cidDirectory', 'CID из справочника')}</option>
        </Select>
      </VStack>
      {directoryMode ? (
        <TrunkDirectoryCidField
          value={directoryMode ? callerId : undefined}
          readOnly={readOnly}
          onChange={(next) => onChange({ callerId: next, callerid: undefined })}
        />
      ) : (
        <VStack gap="4" className={styles.cidValueCol}>
          <Label>{t('routes.apps.trunkCarousel.callerid', 'Номер CallerID (опц.)')}</Label>
          <Input
            disabled={readOnly}
            value={staticValue ?? ''}
            placeholder="79001234567"
            aria-label={t('routes.apps.trunkCarousel.callerid', 'Номер CallerID')}
            onChange={(e) =>
              onChange({
                callerid: e.target.value,
                callerId: { mode: 'static', value: e.target.value },
              })
            }
          />
        </VStack>
      )}
    </HStack>
  );
}

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
  const items: ITrunkCarouselItem[] = Array.isArray(params.trunks) ? params.trunks : [];
  const hint = t(
    'routes.apps.trunkCarousel.hint',
    'Сначала выбирает случайный транк, при недозвоне проходит по упорядоченному списку. Для каждого транка CallerID - статичный номер или справочник.',
  );

  const patchItems = (next: ITrunkCarouselItem[]) => onChange({ trunks: next });

  const addRow = () => patchItems([...items, emptyStaticItem()]);

  const updateRow = (index: number, patch: Partial<ITrunkCarouselItem>) => {
    const next = items.map((row, i) => (i === index ? { ...row, ...patch } : row));
    patchItems(next);
  };

  const removeRow = (index: number) => patchItems(items.filter((_, i) => i !== index));

  return (
    <VStack gap="12" max className={styles.container}>
      {items.map((row, index) => {
        const directoryMode = isDirectoryCaller(row.callerId);
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
                  value={row.trunkId}
                  aria-label={t('routes.apps.trunkCarousel.selectTrunk', 'Транк')}
                  onChange={(e) => updateRow(index, { trunkId: e.target.value })}
                >
                  <option value="">{t('routes.apps.trunkCarousel.selectTrunkOption', 'Выберите транк')}</option>
                  {trunks.map((trunk) => (
                    <option key={trunk.id} value={trunk.id}>
                      {trunk.name || trunk.id}
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
                  value={directoryMode ? 'directory' : 'static'}
                  aria-label={t('routes.apps.trunkCarousel.cidMode', 'Источник CID')}
                  onChange={(e) =>
                    updateRow(index, {
                      callerId:
                        e.target.value === 'directory'
                          ? {
                              mode: 'directory',
                              directoryUid: 0,
                              valueFieldUid: 0,
                              keySource: { source: 'original_caller' },
                              onMissing: 'keep_original',
                            }
                          : { mode: 'static', value: '' },
                    })
                  }
                >
                  <option value="static">{t('routes.apps.trunkCarousel.cidStatic', 'Статичный CID')}</option>
                  <option value="directory">{t('routes.apps.trunkCarousel.cidDirectory', 'CID из справочника')}</option>
                </Select>
              </VStack>
              {directoryMode ? (
                <TrunkDirectoryCidField
                  value={isDirectoryCaller(row.callerId) ? row.callerId : undefined}
                  readOnly={readOnly}
                  onChange={(next) => updateRow(index, { callerId: next })}
                />
              ) : (
                <VStack gap="4" className={styles.cidValueCol}>
                  <Label>{t('routes.apps.trunkCarousel.callerid', 'Номер CallerID (опц.)')}</Label>
                  <Input
                    disabled={readOnly}
                    value={row.callerId.mode === 'static' ? (row.callerId.value ?? '') : ''}
                    placeholder="79001234567"
                    aria-label={t('routes.apps.trunkCarousel.callerid', 'Номер CallerID')}
                    onChange={(e) =>
                      updateRow(index, { callerId: { mode: 'static', value: e.target.value } })
                    }
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
