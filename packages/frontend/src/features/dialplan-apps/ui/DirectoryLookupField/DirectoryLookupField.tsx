import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CallValueSource,
  DirectoryFieldType,
  DirectoryValueSource,
  IDirectoryField,
} from '@krasterisk/shared';
import { Input, Label, Select, InfoTooltip } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useGetDirectoryQuery } from '@/shared/api/endpoints/directoryApi';
import styles from './DirectoryLookupField.module.scss';

export interface DirectoryCatalogItem {
  uid: number;
  name: string;
}

export interface DirectoryLookupFieldProps {
  value: DirectoryValueSource | undefined;
  onChange: (next: DirectoryValueSource) => void;
  directories: DirectoryCatalogItem[];
  expectedType?: DirectoryFieldType | readonly DirectoryFieldType[];
  readOnly?: boolean;
  showOnMissing?: boolean;
}

export interface CallValueSourceFieldProps {
  value: CallValueSource | undefined;
  onChange: (next: CallValueSource) => void;
  readOnly?: boolean;
  hideLabel?: boolean;
}

const KEY_SOURCES: CallValueSource['source'][] = [
  'original_caller',
  'current_caller',
  'route_pattern',
  'fixed',
  'variable',
];

function typeList(
  expected?: DirectoryFieldType | readonly DirectoryFieldType[],
): DirectoryFieldType[] {
  if (!expected) return [];
  return Array.isArray(expected) ? [...expected] : [expected];
}

function fieldMatchesType(
  field: IDirectoryField,
  expected?: DirectoryFieldType | readonly DirectoryFieldType[],
): boolean {
  const types = typeList(expected);
  return types.length === 0 || types.includes(field.type);
}

function isKeySourceComplete(keySource: CallValueSource | undefined): boolean {
  if (!keySource) return false;
  if (keySource.source === 'fixed') return keySource.value.trim().length > 0;
  if (keySource.source === 'variable') return keySource.name.trim().length > 0;
  return true;
}

function isComplete(next: DirectoryValueSource): boolean {
  return (
    next.source === 'directory' &&
    Number.isInteger(next.directoryUid) &&
    next.directoryUid > 0 &&
    Number.isInteger(next.valueFieldUid) &&
    next.valueFieldUid > 0 &&
    isKeySourceComplete(next.keySource) &&
    (next.onMissing === 'keep' || next.onMissing === 'empty' || next.onMissing === 'skip')
  );
}

export function CallValueSourceField({
  value,
  onChange,
  readOnly,
  hideLabel,
}: CallValueSourceFieldProps) {
  const { t } = useTranslation();
  const source = value?.source ?? 'original_caller';
  const label = t('routes.chain.directoryLookup.keySource', 'Ключ поиска');
  const hint = t(
    'routes.chain.directoryLookup.keySourceHint',
    '**Исходный CallerID** - номер звонящего на входе в маршрут\n**Текущий CallerID** - текущий номер звонящего\n**B-номер маршрута** - набранный номер\n**Фиксированное значение** - постоянный ключ\n**Из переменной** - имя переменной канала без ${}',
  );

  const handleSource = (raw: string) => {
    if (raw === 'fixed') {
      onChange({ source: 'fixed', value: value?.source === 'fixed' ? value.value : '' });
      return;
    }
    if (raw === 'variable') {
      onChange({ source: 'variable', name: value?.source === 'variable' ? value.name : '' });
      return;
    }
    onChange({ source: raw as Exclude<CallValueSource['source'], 'fixed' | 'variable'> });
  };

  return (
    <VStack gap="8" max className={styles.field}>
      {!hideLabel ? (
        <HStack gap="4" align="center">
          <Label className={styles.label}>{label}</Label>
          <InfoTooltip text={hint} />
        </HStack>
      ) : null}
      <Select
        disabled={readOnly}
        value={source}
        aria-label={label}
        onChange={(e) => handleSource(e.target.value)}
      >
        {KEY_SOURCES.map((item) => (
          <option key={item} value={item}>
            {item === 'original_caller'
              ? t('routes.chain.directoryLookup.originalCaller', 'Исходный CallerID')
              : item === 'current_caller'
                ? t('routes.chain.directoryLookup.currentCaller', 'Текущий CallerID')
                : item === 'route_pattern'
                  ? t('routes.chain.source.routeNumber', 'B-номер маршрута')
                  : item === 'fixed'
                    ? t('routes.chain.source.fixed', 'Фиксированное значение')
                    : t('routes.chain.source.variable', 'Из переменной')}
          </option>
        ))}
      </Select>
      {source === 'fixed' ? (
        <Input
          value={value?.source === 'fixed' ? value.value : ''}
          disabled={readOnly}
          aria-label={t('routes.chain.directoryLookup.fixedKey', 'Значение ключа')}
          onChange={(e) => onChange({ source: 'fixed', value: e.target.value })}
        />
      ) : null}
      {source === 'variable' ? (
        <Input
          value={value?.source === 'variable' ? value.name : ''}
          disabled={readOnly}
          aria-label={t('routes.chain.fields.variableName', 'Имя переменной')}
          placeholder={t('routes.chain.fields.variableNamePlaceholder', 'Например: MY_QUEUE')}
          onChange={(e) => onChange({ source: 'variable', name: e.target.value })}
        />
      ) : null}
    </VStack>
  );
}

export function DirectoryLookupField({
  value,
  onChange,
  directories,
  expectedType,
  readOnly,
  showOnMissing = true,
}: DirectoryLookupFieldProps) {
  const { t } = useTranslation();
  const [draftUid, setDraftUid] = useState<number | null>(null);
  const [draftKeySource, setDraftKeySource] = useState<CallValueSource | null>(null);
  const lastEmitRef = useRef('');
  const directoryUid = draftUid ?? value?.directoryUid ?? 0;
  const keySource = draftKeySource ?? value?.keySource;
  const query = useGetDirectoryQuery(directoryUid, { skip: directoryUid <= 0 });
  const fields = query.data?.fields ?? [];

  useEffect(() => {
    if (value?.directoryUid && value.directoryUid === draftUid) {
      setDraftUid(null);
    }
  }, [value?.directoryUid, draftUid]);

  useEffect(() => {
    if (
      draftKeySource &&
      value?.keySource &&
      JSON.stringify(value.keySource) === JSON.stringify(draftKeySource)
    ) {
      setDraftKeySource(null);
    }
  }, [value?.keySource, draftKeySource]);

  useEffect(() => {
    if (!draftUid || query.data?.uid !== draftUid) return;
    const nextFields = query.data.fields ?? [];
    const current = value?.valueFieldUid;
    const keep = nextFields.find((field) => field.uid === current && fieldMatchesType(field, expectedType));
    const fallback = nextFields.find((field) => fieldMatchesType(field, expectedType));
    const nextFieldUid = keep?.uid ?? fallback?.uid ?? 0;
    const next: DirectoryValueSource = {
      source: 'directory',
      directoryUid: draftUid,
      keySource: draftKeySource ?? value?.keySource ?? { source: 'original_caller' },
      valueFieldUid: nextFieldUid,
      onMissing: value?.onMissing ?? 'skip',
    };
    const token = JSON.stringify(next);
    if (isComplete(next) && token !== lastEmitRef.current) {
      lastEmitRef.current = token;
      onChange(next);
    }
  }, [draftUid, draftKeySource, expectedType, onChange, query.data, value]);

  const visibleFields = fields.filter(
    (field) => fieldMatchesType(field, expectedType) || field.uid === value?.valueFieldUid,
  );

  const emit = (patch: Partial<DirectoryValueSource>) => {
    const next: DirectoryValueSource = {
      source: 'directory',
      directoryUid: patch.directoryUid ?? draftUid ?? value?.directoryUid ?? 0,
      keySource: patch.keySource ?? draftKeySource ?? value?.keySource ?? { source: 'original_caller' },
      valueFieldUid: patch.valueFieldUid ?? value?.valueFieldUid ?? 0,
      onMissing: patch.onMissing ?? value?.onMissing ?? 'skip',
    };
    if (isComplete(next)) {
      lastEmitRef.current = JSON.stringify(next);
      onChange(next);
    }
  };

  const directoryLabel = t('routes.chain.directoryLookup.directory', 'Справочник');
  const fieldLabel = t('routes.chain.directoryLookup.selectField', 'Поле записи');
  const missingLabel = t('routes.chain.directoryLookup.onMissing', 'Если записи нет');
  const missingHint = t(
    'routes.chain.directoryLookup.valueOnMissingHint',
    '**Пропустить** - приложение не выполняется\n**Оставить** - текущее значение не меняется\n**Очистить** - подставляется пустое значение',
  );

  return (
    <VStack gap="8" max className={styles.field}>
      <VStack gap="8" max>
        <Label className={styles.label}>{directoryLabel}</Label>
        <Select
          disabled={readOnly || query.isLoading}
          value={directoryUid ? String(directoryUid) : ''}
          aria-label={directoryLabel}
          onChange={(e) => {
            const uid = Number(e.target.value) || 0;
            setDraftUid(uid);
          }}
        >
          <option value="">{t('routes.chain.source.selectPhonebook', 'Выберите справочник')}</option>
          {directories.map((item) => (
            <option key={item.uid} value={String(item.uid)}>
              {item.name}
            </option>
          ))}
        </Select>
      </VStack>

      <CallValueSourceField
        value={keySource}
        readOnly={readOnly}
        onChange={(nextKey) => {
          setDraftKeySource(nextKey);
          emit({ keySource: nextKey });
        }}
      />

      {directoryUid > 0 ? (
        <VStack gap="8" max>
          <Label className={styles.label}>{fieldLabel}</Label>
          <Select
            disabled={readOnly || query.isLoading}
            value={value?.valueFieldUid ? String(value.valueFieldUid) : ''}
            aria-label={fieldLabel}
            onChange={(e) => emit({ valueFieldUid: Number(e.target.value) || 0 })}
          >
            <option value="">{t('routes.chain.source.selectVarKeyPlaceholder', 'Выберите поле')}</option>
            {visibleFields.map((field) => (
              <option key={field.uid} value={String(field.uid)}>
                {field.label}
              </option>
            ))}
          </Select>
        </VStack>
      ) : null}

      {showOnMissing ? (
        <VStack gap="8" max>
          <HStack gap="4" align="center">
            <Label className={styles.label}>{missingLabel}</Label>
            <InfoTooltip text={missingHint} />
          </HStack>
          <Select
            disabled={readOnly}
            value={value?.onMissing ?? 'skip'}
            aria-label={missingLabel}
            onChange={(e) =>
              emit({ onMissing: e.target.value as DirectoryValueSource['onMissing'] })
            }
          >
            <option value="skip">{t('routes.chain.directoryLookup.onMissingSkip', 'Пропустить')}</option>
            <option value="keep">{t('routes.chain.directoryLookup.onMissingKeep', 'Оставить как есть')}</option>
            <option value="empty">{t('routes.chain.directoryLookup.onMissingEmpty', 'Очистить')}</option>
          </Select>
        </VStack>
      ) : null}
    </VStack>
  );
}
