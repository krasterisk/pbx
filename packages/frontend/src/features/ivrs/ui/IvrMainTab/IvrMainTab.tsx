import { useTranslation } from 'react-i18next';
import { VStack, HStack, Input, Label, Checkbox } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';

export interface IvrMainTabProps {
  name: string;
  onNameChange: (val: string) => void;
  exten: string;
  onExtenChange: (val: string) => void;
  timeoutMs: string;
  onTimeoutMsChange: (val: string) => void;
  maxCount: number;
  onMaxCountChange: (val: number) => void;
  active: boolean;
  onActiveChange: (val: boolean) => void;
  directDial: boolean;
  onDirectDialChange: (val: boolean) => void;
}

export function IvrMainTab(props: IvrMainTabProps) {
  const { t } = useTranslation();
  const {
    name, onNameChange,
    exten, onExtenChange,
    timeoutMs, onTimeoutMsChange,
    maxCount, onMaxCountChange,
    active, onActiveChange,
    directDial, onDirectDialChange
  } = props;

  return (
    <VStack gap="16" className="w-full">
      <VStack gap="4" className="w-full">
        <Label>{t('ivrs.fields.name', 'Системное имя')}</Label>
        <Input 
          placeholder={t('ivrs.placeholders.name', 'Например: Основное меню')} 
          value={name} 
          onChange={e => onNameChange(e.target.value)} 
        />
      </VStack>

      <VStack gap="4" className="w-full">
        <HStack align="center" gap="4">
          <Label>{t('ivrs.fields.exten', 'Внутренний номер меню (Exten)')}</Label>
          <InfoTooltip text={t('ivrs.tooltips.exten', 'Внутренний номер, по которому будет доступно голосовое меню. Абоненты, набравшие этот номер, попадут в IVR')} />
        </HStack>
        <Input 
          placeholder="5000" 
          value={exten} 
          onChange={e => onExtenChange(e.target.value)} 
        />
      </VStack>

      <VStack gap="4" className="w-full">
        <HStack align="center" gap="4">
          <Label>{t('ivrs.fields.timeout', 'Таймаут ожидания ввода (сек)')}</Label>
          <InfoTooltip text={t('ivrs.tooltips.timeout', 'Время ожидания (в секундах) после воспроизведения приветствия, в течение которого система ожидает DTMF-ввода от абонента')} />
        </HStack>
        <Input 
          placeholder="10" 
          value={timeoutMs} 
          onChange={e => onTimeoutMsChange(e.target.value)} 
        />
      </VStack>

      <VStack gap="4" className="w-full">
        <HStack align="center" gap="4">
          <Label>{t('ivrs.fields.maxCount', 'Ограничение переходов (0 - без предела)')}</Label>
          <InfoTooltip text={t('ivrs.tooltips.maxCount', 'Максимальное количество ошибочных попыток ввода, после которого вызов будет обработан по маршруту ошибки. 0 — без ограничений')} />
        </HStack>
        <Input 
          type="number" 
          placeholder="3" 
          value={maxCount} 
          onChange={e => onMaxCountChange(parseInt(e.target.value, 10) || 0)} 
        />
      </VStack>

      <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background w-full">
        <HStack align="center" gap="4">
          <Label className="cursor-pointer" htmlFor="ivr-active">
            {t('ivrs.fields.active', 'Активно')}
          </Label>
          <InfoTooltip text={t('ivrs.tooltips.active', 'Включает/отключает обработку вызовов в данном IVR. Отключённое меню будет пропускать вызовы')} />
        </HStack>
        <Checkbox 
          id="ivr-active"
          checked={active}
          onChange={e => onActiveChange(e.target.checked)} 
        />
      </HStack>

      <HStack align="center" justify="between" className="border border-border p-3 rounded bg-background w-full">
        <HStack align="center" gap="4">
          <Label className="cursor-pointer" htmlFor="ivr-direct-dial">
            {t('ivrs.fields.directDial', 'Прямой донабор')}
          </Label>
          <InfoTooltip text={t('ivrs.tooltips.directDial', 'Позволяет абоненту набрать внутренний номер напрямую, не дожидаясь окончания голосового приветствия')} />
        </HStack>
        <Checkbox 
          id="ivr-direct-dial"
          checked={directDial}
          onChange={e => onDirectDialChange(e.target.checked)} 
        />
      </HStack>
    </VStack>
  );
}
