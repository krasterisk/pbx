import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select, Checkbox, Label, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { ExtensionChips } from '../ExtensionChips/ExtensionChips';
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
  checkBlacklist: boolean;
  setCheckBlacklist: (v: boolean) => void;
  checkListbook: boolean;
  setCheckListbook: (v: boolean) => void;
  preCommand: string;
  setPreCommand: (v: string) => void;
}

export const RouteGeneralTab = memo((props: RouteGeneralTabProps) => {
  const {
    name, setName, extensions, setExtensions, active, setActive,
    routeType, setRouteType, record, setRecord, recordAll, setRecordAll,
    checkBlacklist, setCheckBlacklist, checkListbook, setCheckListbook,
    preCommand, setPreCommand
  } = props;
  
  const { t } = useTranslation();

  return (
    <VStack gap="16">
      <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background w-full">
        <HStack align="center" gap="4">
          <Label className="cursor-pointer" htmlFor="route-active">
            {t('common.active', 'Активен')}
          </Label>
        </HStack>
        <Checkbox 
          id="route-active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)} 
        />
      </HStack>

      <VStack gap="4">
        <Label htmlFor="route-name">{t('routes.name', 'Наименование маршрута')}</Label>
        <Input 
          id="route-name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder={t('routes.namePlaceholder', 'Входящий городской')} 
        />
      </VStack>

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

      <VStack className={styles.optionsGrid} max w-full>
        <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background w-full">
          <Label className="cursor-pointer" htmlFor="route-record">{t('routes.record', 'Записывать разговоры')}</Label>
          <Checkbox checked={record} onChange={(e) => setRecord(e.target.checked)} id="route-record" />
        </HStack>
        
        <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background w-full">
          <Label className="cursor-pointer" htmlFor="route-recordAll">{t('routes.recordAll', 'Запись без соединения')}</Label>
          <Checkbox checked={recordAll} onChange={(e) => setRecordAll(e.target.checked)} id="route-recordAll" />
        </HStack>

        <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background w-full">
          <Label className="cursor-pointer" htmlFor="route-checkBlacklist">{t('routes.checkBlacklist', 'Проверять Blacklist')}</Label>
          <Checkbox checked={checkBlacklist} onChange={(e) => setCheckBlacklist(e.target.checked)} id="route-checkBlacklist" />
        </HStack>

        <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background w-full">
          <Label className="cursor-pointer" htmlFor="route-checkListbook">{t('routes.checkListbook', 'Имя из справочника')}</Label>
          <Checkbox checked={checkListbook} onChange={(e) => setCheckListbook(e.target.checked)} id="route-checkListbook" />
        </HStack>
      </VStack>

      <VStack gap="4">
        <Label htmlFor="route-precmd">{t('routes.preCommand', 'Предварительная команда')}</Label>
        <Input 
          id="route-precmd" 
          value={preCommand} 
          onChange={(e) => setPreCommand(e.target.value)} 
          placeholder="Set(CALLERID(num)=8${CALLERID(num)})" 
          className={styles.mono} 
        />
      </VStack>
    </VStack>
  );
});

RouteGeneralTab.displayName = 'RouteGeneralTab';
