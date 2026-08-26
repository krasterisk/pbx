import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Input, Label, Checkbox, Text } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import cls from './IvrMainTab.module.scss';

export interface IvrMainTabProps {
  name: string;
  onNameChange: (val: string) => void;
  waitExten: string;
  onWaitExtenChange: (val: string) => void;
  timeoutResponse: string;
  onTimeoutResponseChange: (val: string) => void;
  timeoutDigit: string;
  onTimeoutDigitChange: (val: string) => void;
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
    waitExten,
    onWaitExtenChange,
    timeoutResponse,
    onTimeoutResponseChange,
    timeoutDigit,
    onTimeoutDigitChange,
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

      <VStack gap="12" max className={cls.timeoutsSection}>
        <Text variant="small" className={cls.timeoutsHeading}>
          {t('ivrs.fields.timeoutsSection', 'Таймауты DTMF')}
        </Text>

        <VStack gap="4" max className={cls.field}>
          <HStack gap="4" align="center" className={cls.labelRow}>
            <Label htmlFor="ivr-wait-exten">
              {t('ivrs.fields.waitExten', 'Ожидание выбора после фразы (сек)')}
            </Label>
            <InfoTooltip
              text={t(
                'ivrs.tooltips.waitExten',
                'WaitExten: сколько секунд ждать нажатие пункта меню после проигрывания фраз. По истечении срабатывает маршрут «t» (timeout), если он настроен',
              )}
            />
          </HStack>
          <Input
            id="ivr-wait-exten"
            type="number"
            min={1}
            placeholder="10"
            value={waitExten}
            onChange={(e) => onWaitExtenChange(e.target.value)}
          />
        </VStack>

        <VStack gap="4" max className={cls.field}>
          <HStack gap="4" align="center" className={cls.labelRow}>
            <Label htmlFor="ivr-timeout-response">
              {t('ivrs.fields.timeoutResponse', 'Таймаут первой цифры (сек)')}
            </Label>
            <InfoTooltip
              text={t(
                'ivrs.tooltips.timeoutResponse',
                'TIMEOUT(response): сколько секунд ждать первую DTMF-цифру - во время и после проигрывания фразы (Background). Важно при прямом донаборе',
              )}
            />
          </HStack>
          <Input
            id="ivr-timeout-response"
            type="number"
            min={1}
            placeholder="10"
            value={timeoutResponse}
            onChange={(e) => onTimeoutResponseChange(e.target.value)}
          />
        </VStack>

        <VStack gap="4" max className={cls.field}>
          <HStack gap="4" align="center" className={cls.labelRow}>
            <Label htmlFor="ivr-timeout-digit">
              {t('ivrs.fields.timeoutDigit', 'Пауза между цифрами (сек)')}
            </Label>
            <InfoTooltip
              text={t(
                'ivrs.tooltips.timeoutDigit',
                'TIMEOUT(digit): пауза между последующими DTMF-цифрами при наборе многозначного паттерна или прямом донаборе внутреннего номера',
              )}
            />
          </HStack>
          <Input
            id="ivr-timeout-digit"
            type="number"
            min={1}
            placeholder="5"
            value={timeoutDigit}
            onChange={(e) => onTimeoutDigitChange(e.target.value)}
          />
        </VStack>
      </VStack>

      <VStack gap="4" max className={cls.field}>
        <HStack gap="4" align="center" className={cls.labelRow}>
          <Label htmlFor="ivr-max-count">
            {t('ivrs.fields.maxCount', 'Ограничение переходов (0 - без предела)')}
          </Label>
          <InfoTooltip
            text={t(
              'ivrs.tooltips.maxCount',
              'Максимальное количество ошибочных попыток ввода, после которого вызов будет обработан по маршруту ошибки. 0 - без ограничений',
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
