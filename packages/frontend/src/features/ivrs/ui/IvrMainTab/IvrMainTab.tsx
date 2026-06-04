import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Input, Label, Checkbox } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import cls from './IvrMainTab.module.scss';

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
    name,
    onNameChange,
    exten,
    onExtenChange,
    timeoutMs,
    onTimeoutMsChange,
    maxCount,
    onMaxCountChange,
    active,
    onActiveChange,
    directDial,
    onDirectDialChange,
  } = props;

  return (
    <VStack gap="16" max className={cls.form}>
      <HStack justify="between" align="center" className={cls.activePanel}>
        <HStack gap="4" align="center">
          <Label htmlFor="ivr-active" className={cls.activeLabel}>
            {t('ivrs.fields.active', 'Активно')}
          </Label>
          <InfoTooltip
            text={t(
              'ivrs.tooltips.active',
              'Включает/отключает обработку вызовов в данном IVR. Отключённое меню будет пропускать вызовы',
            )}
          />
        </HStack>
        <Checkbox
          id="ivr-active"
          checked={active}
          onChange={(e) => onActiveChange(e.target.checked)}
        />
      </HStack>

      <VStack gap="4" max className={cls.field}>
        <Label htmlFor="ivr-name">{t('ivrs.fields.name', 'Системное имя')}</Label>
        <Input
          id="ivr-name"
          placeholder={t('ivrs.placeholders.name', 'Например: Основное меню')}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </VStack>

      <VStack gap="4" max className={cls.field}>
        <HStack gap="4" align="center" className={cls.labelRow}>
          <Label htmlFor="ivr-exten">{t('ivrs.fields.exten', 'Внутренний номер меню (Exten)')}</Label>
          <InfoTooltip
            text={t(
              'ivrs.tooltips.exten',
              'Внутренний номер, по которому будет доступно голосовое меню. Абоненты, набравшие этот номер, попадут в IVR',
            )}
          />
        </HStack>
        <Input
          id="ivr-exten"
          placeholder="5000"
          value={exten}
          onChange={(e) => onExtenChange(e.target.value)}
        />
      </VStack>

      <VStack gap="4" max className={cls.field}>
        <HStack gap="4" align="center" className={cls.labelRow}>
          <Label htmlFor="ivr-timeout">{t('ivrs.fields.timeout', 'Таймаут ожидания ввода (сек)')}</Label>
          <InfoTooltip
            text={t(
              'ivrs.tooltips.timeout',
              'Время ожидания (в секундах) после воспроизведения приветствия, в течение которого система ожидает DTMF-ввода от абонента',
            )}
          />
        </HStack>
        <Input
          id="ivr-timeout"
          placeholder="10"
          value={timeoutMs}
          onChange={(e) => onTimeoutMsChange(e.target.value)}
        />
      </VStack>

      <VStack gap="4" max className={cls.field}>
        <HStack gap="4" align="center" className={cls.labelRow}>
          <Label htmlFor="ivr-max-count">
            {t('ivrs.fields.maxCount', 'Ограничение переходов (0 - без предела)')}
          </Label>
          <InfoTooltip
            text={t(
              'ivrs.tooltips.maxCount',
              'Максимальное количество ошибочных попыток ввода, после которого вызов будет обработан по маршруту ошибки. 0 — без ограничений',
            )}
          />
        </HStack>
        <Input
          id="ivr-max-count"
          type="number"
          placeholder="3"
          value={maxCount}
          onChange={(e) => onMaxCountChange(parseInt(e.target.value, 10) || 0)}
        />
      </VStack>

      <HStack justify="between" align="center" className={cls.toggleRow}>
        <HStack gap="4" align="center">
          <Label htmlFor="ivr-direct-dial" className={cls.toggleLabel}>
            {t('ivrs.fields.directDial', 'Прямой донабор')}
          </Label>
          <InfoTooltip
            text={t(
              'ivrs.tooltips.directDial',
              'Позволяет абоненту набрать внутренний номер напрямую, не дожидаясь окончания голосового приветствия',
            )}
          />
        </HStack>
        <Checkbox
          id="ivr-direct-dial"
          checked={directDial}
          onChange={(e) => onDirectDialChange(e.target.checked)}
        />
      </HStack>
    </VStack>
  );
}
