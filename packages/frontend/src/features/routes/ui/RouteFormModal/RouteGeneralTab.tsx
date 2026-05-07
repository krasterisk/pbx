import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select, Checkbox, Label, InfoTooltip } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { ExtensionChips } from '../ExtensionChips/ExtensionChips';
import { PhonebookSelect } from '@/features/phonebooks';
import type { IContext } from '@/shared/api/endpoints/contextApi';
import styles from './RouteFormModal.module.scss';

export interface RouteGeneralTabProps {
  name: string;
  setName: (v: string) => void;
  extensions: string[];
  setExtensions: (v: string[]) => void;
  active: boolean;
  setActive: (v: boolean) => void;
  routeType: number;
  setRouteType: (v: number) => void;
  record: boolean;
  setRecord: (v: boolean) => void;
  recordAll: boolean;
  setRecordAll: (v: boolean) => void;
  phonebookUids: number[];
  setPhonebookUids: (v: number[]) => void;
  /** Context selector (create/copy mode) */
  contextUid: number | null;
  setContextUid: (v: number) => void;
  isCreateMode: boolean;
  contexts: IContext[];
}

/** Encode record/recordAll pair into a single select value */
function encodeRecordMode(record: boolean, recordAll: boolean): string {
  if (!record) return 'off';
  return recordAll ? 'all' : 'calls';
}

/** Decode: protect against API sending record_all:true without record:true */
export function decodeRecordMode(opts: { record?: boolean; record_all?: boolean }): 'off' | 'calls' | 'all' {
  if (!opts.record) return 'off';
  return opts.record_all ? 'all' : 'calls';
}

export const RouteGeneralTab = memo((props: RouteGeneralTabProps) => {
  const {
    name, setName, extensions, setExtensions, active, setActive,
    routeType, setRouteType, record, setRecord, recordAll, setRecordAll,
    phonebookUids, setPhonebookUids,
    contextUid, setContextUid, isCreateMode, contexts,
  } = props;

  const { t } = useTranslation();

  const handleRecordModeChange = (mode: string) => {
    switch (mode) {
      case 'off':
        setRecord(false);
        setRecordAll(false);
        break;
      case 'calls':
        setRecord(true);
        setRecordAll(false);
        break;
      case 'all':
        setRecord(true);
        setRecordAll(true);
        break;
    }
  };

  return (
    <VStack gap="16">
      {/* Active toggle */}
      <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background w-full">
        <Label className="cursor-pointer" htmlFor="route-active">
          {t('common.active', 'Активен')}
        </Label>
        <Checkbox
          id="route-active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </HStack>

      {/* Name + Context in one responsive row */}
      <HStack gap="12" className={styles.nameContextRow}>
        <VStack gap="4" className={styles.nameContextField}>
          <Label htmlFor="route-name">{t('routes.name', 'Наименование маршрута')}</Label>
          <Input
            id="route-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('routes.namePlaceholder', 'Входящий городской')}
          />
        </VStack>

        <VStack gap="4" className={styles.nameContextField}>
            <Label htmlFor="route-context">{t('routes.context', 'Контекст')} *</Label>
            <Select
              id="route-context"
              value={contextUid ?? ''}
              onChange={(e) => setContextUid(Number(e.target.value))}
            >
              <option value="" disabled>{t('routes.selectContext', 'Выберите контекст')}</option>
              {contexts.map((ctx) => (
                <option key={ctx.uid} value={ctx.uid}>
                  {ctx.name} {ctx.comment ? `(${ctx.comment})` : ''}
                </option>
              ))}
            </Select>
          </VStack>
      </HStack>

      <ExtensionChips value={extensions} onChange={setExtensions} />

      <VStack gap="4">
        <Label htmlFor="route-type">{t('routes.routeType', 'Тип маршрута (права доступа)')}</Label>
        <Select
          id="route-type"
          value={routeType}
          onChange={(e) => setRouteType(Number(e.target.value))}
        >
          <option value={0}>{t('routes.routeTypeOption.0', 'Не использовать')}</option>
          <option value={1}>{t('routes.routeTypeOption.1', 'Локальные вызовы')}</option>
          <option value={2}>{t('routes.routeTypeOption.2', 'Местные вызовы')}</option>
          <option value={3}>{t('routes.routeTypeOption.3', 'Мобильные вызовы')}</option>
          <option value={4}>{t('routes.routeTypeOption.4', 'Междугородние вызовы')}</option>
          <option value={5}>{t('routes.routeTypeOption.5', 'Международные вызовы')}</option>
        </Select>
      </VStack>

      {/* Recording - single select combining record + recordAll */}
      <VStack gap="4">
        <HStack gap="4" align="center">
          <Label htmlFor="route-record-mode">{t('routes.recordMode', 'Запись разговоров')}</Label>
          <InfoTooltip text={t('routes.recordModeTooltip', 'При соединении - запись начинается после ответа. Все вызовы - запись ведётся с момента входящего вызова, включая ожидание и IVR.')} />
        </HStack>
        <Select
          id="route-record-mode"
          value={encodeRecordMode(record, recordAll)}
          onChange={(e) => handleRecordModeChange(e.target.value)}
        >
          <option value="off">{t('routes.recordOff', 'Не записывать')}</option>
          <option value="calls">{t('routes.recordCalls', 'При соединении')}</option>
          <option value="all">{t('routes.recordAllCalls', 'Все вызовы (включая без соединения)')}</option>
        </Select>
      </VStack>

      {/* Phonebook Select */}
      <PhonebookSelect
        value={phonebookUids}
        onChange={setPhonebookUids}
      />
    </VStack>
  );
});

RouteGeneralTab.displayName = 'RouteGeneralTab';
