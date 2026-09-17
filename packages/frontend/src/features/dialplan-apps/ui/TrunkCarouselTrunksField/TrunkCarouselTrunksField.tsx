import { useTranslation } from 'react-i18next';
import type {
  ITrunkCarouselItem,
  TrunkCallerIdPoolPick,
  TrunkCallerIdSource,
} from '@krasterisk/shared';
import { Button, Input, Label, Select, TagInput, Text, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { Plus, Trash2 } from 'lucide-react';
import { useGetDirectoryQuery } from '@/shared/api/endpoints/directoryApi';
import { useSchemaRefs } from '../../model/useSchemaRefs';
import styles from './TrunkCarouselTrunksField.module.scss';

const DEFAULT_TRUNK_TIMEOUT = 60;

type DirectoryCallerId = Extract<TrunkCallerIdSource, { mode: 'directory' }>;
type PoolCallerId = Extract<TrunkCallerIdSource, { mode: 'pool' }>;

function isDirectoryCaller(value: TrunkCallerIdSource | undefined): value is DirectoryCallerId {
  return value?.mode === 'directory';
}

function isPoolCaller(value: TrunkCallerIdSource | undefined): value is PoolCallerId {
  return value?.mode === 'pool';
}

function sanitizePoolNumber(raw: string): string {
  return raw.replace(/[|;]/g, '').trim();
}

function emptyStaticItem(): ITrunkCarouselItem {
  return {
    trunkId: '',
    callerId: { mode: 'static', value: '' },
    timeout: DEFAULT_TRUNK_TIMEOUT,
  };
}

function emptyPoolCaller(): PoolCallerId {
  return { mode: 'pool', numbers: [], pick: 'random' };
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

export function TrunkPoolCidField({
  value,
  onChange,
  readOnly,
}: {
  value: PoolCallerId | undefined;
  onChange: (next: PoolCallerId) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const numbers = value?.numbers ?? [];
  const pick: TrunkCallerIdPoolPick = value?.pick === 'round_robin' ? 'round_robin' : 'random';

  return (
    <VStack gap="8" max className={styles.cidValueCol}>
      <VStack gap="4" max>
        <HStack gap="4" align="center">
          <Label>{t('routes.apps.trunkCarousel.cidPoolNumbers', 'Номера CID')}</Label>
          <InfoTooltip
            text={t(
              'routes.apps.trunkCarousel.cidPoolHint',
              'Один номер из списка подставляется в CALLERID(num). Случайный и по кругу не повторяют тот же номер на следующем звонке.',
            )}
          />
        </HStack>
        <TagInput
          value={numbers}
          onChange={(next) =>
            onChange({
              mode: 'pool',
              numbers: next.map(sanitizePoolNumber).filter(Boolean),
              pick,
            })
          }
          placeholder={t('routes.apps.trunkCarousel.cidPoolAdd', 'Добавить номер')}
          disabled={readOnly}
        />
      </VStack>
      <VStack gap="4" max>
        <Label>{t('routes.apps.trunkCarousel.cidPoolPick', 'Порядок CID')}</Label>
        <Select
          disabled={readOnly}
          value={pick}
          aria-label={t('routes.apps.trunkCarousel.cidPoolPick', 'Порядок CID')}
          onChange={(e) =>
            onChange({
              mode: 'pool',
              numbers,
              pick: e.target.value === 'round_robin' ? 'round_robin' : 'random',
            })
          }
        >
          <option value="random">
            {t('routes.apps.trunkCarousel.cidPickRandom', 'Случайный')}
          </option>
          <option value="round_robin">
            {t('routes.apps.trunkCarousel.cidPickRoundRobin', 'По кругу')}
          </option>
        </Select>
      </VStack>
    </VStack>
  );
}

function TrunkRowCidEditor({
  callerId,
  onChange,
  readOnly,
}: {
  callerId: TrunkCallerIdSource;
  onChange: (next: TrunkCallerIdSource) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const mode = callerId.mode === 'directory' || callerId.mode === 'pool' ? callerId.mode : 'static';

  return (
    <HStack gap="8" align="end" max className={styles.cidRow}>
      <VStack gap="4" className={styles.cidModeCol}>
        <Label>{t('routes.apps.trunkCarousel.cidMode', 'Источник CID')}</Label>
        <Select
          disabled={readOnly}
          value={mode}
          aria-label={t('routes.apps.trunkCarousel.cidMode', 'Источник CID')}
          onChange={(e) => {
            const next = e.target.value;
            if (next === 'directory') {
              onChange({
                mode: 'directory',
                directoryUid: 0,
                valueFieldUid: 0,
                keySource: { source: 'original_caller' },
                onMissing: 'keep_original',
              });
              return;
            }
            if (next === 'pool') {
              onChange(emptyPoolCaller());
              return;
            }
            onChange({
              mode: 'static',
              value: callerId.mode === 'static' ? (callerId.value ?? '') : '',
            });
          }}
        >
          <option value="static">{t('routes.apps.trunkCarousel.cidStatic', 'Статичный CID')}</option>
          <option value="directory">{t('routes.apps.trunkCarousel.cidDirectory', 'CID из справочника')}</option>
          <option value="pool">{t('routes.apps.trunkCarousel.cidPool', 'Из списка (пул)')}</option>
        </Select>
      </VStack>
      {isDirectoryCaller(callerId) ? (
        <TrunkDirectoryCidField
          value={callerId}
          readOnly={readOnly}
          onChange={onChange}
        />
      ) : isPoolCaller(callerId) ? (
        <TrunkPoolCidField value={callerId} readOnly={readOnly} onChange={onChange} />
      ) : (
        <VStack gap="4" className={styles.cidValueCol}>
          <Label>{t('routes.apps.trunkCarousel.callerid', 'Номер CallerID (опц.)')}</Label>
          <Input
            disabled={readOnly}
            value={callerId.mode === 'static' ? (callerId.value ?? '') : ''}
            placeholder="79001234567"
            aria-label={t('routes.apps.trunkCarousel.callerid', 'Номер CallerID')}
            onChange={(e) => onChange({ mode: 'static', value: e.target.value })}
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
  const refs = useSchemaRefs(['trunkIds']);
  const trunks = refs.trunkIds?.items ?? [];
  const trunksLoading = refs.trunkIds?.isLoading ?? false;
  const items: ITrunkCarouselItem[] = Array.isArray(params.trunks) ? params.trunks : [];
  const traversalMode = params.mode === 'sequential' ? 'sequential' : 'random_then_failover';
  const hint = t(
    'routes.apps.trunkCarousel.hint',
    'При нескольких транках: сначала выбранный (или по порядку), при недозвоне обход списка. Для каждого транка CallerID - статичный номер, справочник или пул.',
  );

  const patchItems = (next: ITrunkCarouselItem[]) => {
    onChange({
      trunks: next,
      trunkMode: next.length >= 2 ? 'carousel' : 'single',
    });
  };

  const addRow = () => patchItems([...items, emptyStaticItem()]);

  const updateRow = (index: number, patch: Partial<ITrunkCarouselItem>) => {
    const next = items.map((row, i) => (i === index ? { ...row, ...patch } : row));
    patchItems(next);
  };

  const removeRow = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    patchItems(next.length > 0 ? next : [emptyStaticItem()]);
  };

  return (
    <VStack gap="12" max className={styles.container}>
      {items.length >= 2 ? (
        <VStack gap="4" max>
          <Label>{t('routes.chain.trunkCarousel.mode', 'Порядок обхода')}</Label>
          <Select
            disabled={readOnly}
            value={traversalMode}
            aria-label={t('routes.chain.trunkCarousel.mode', 'Порядок обхода')}
            onChange={(e) =>
              onChange({
                mode: e.target.value === 'sequential' ? 'sequential' : 'random_then_failover',
              })
            }
          >
            <option value="random_then_failover">
              {t('routes.chain.trunkCarousel.modeRandom', 'Случайный, затем по списку')}
            </option>
            <option value="sequential">
              {t('routes.chain.trunkCarousel.modeSequential', 'По порядку')}
            </option>
          </Select>
        </VStack>
      ) : null}

      {items.map((row, index) => (
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
                  <option key={trunk.value} value={trunk.value}>
                    {trunk.label}
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
            {!readOnly && items.length > 1 ? (
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
          <TrunkRowCidEditor
            callerId={row.callerId ?? { mode: 'static', value: '' }}
            readOnly={readOnly}
            onChange={(next) => updateRow(index, { callerId: next })}
          />
        </VStack>
      ))}
      {!readOnly ? (
        <Button type="button" variant="outline" onClick={addRow}>
          <Plus size={16} />
          {t('routes.apps.trunkCarousel.addTrunk', 'Добавить транк')}
        </Button>
      ) : null}
    </VStack>
  );
}
