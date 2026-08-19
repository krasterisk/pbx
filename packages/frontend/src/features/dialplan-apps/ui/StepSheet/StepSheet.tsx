import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, IRouteAction, ValueSource } from '@krasterisk/shared';
import {
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Text,
  InfoTooltip,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { dialplanAppsRegistry } from '../../model/registry';
import type { FieldSchema } from '../../model/schema.types';
import { ActionTypeSelect } from '../ActionTypeSelect';
import { isValueSourceComplete, ValueSourceField } from '../ValueSourceField/ValueSourceField';
import styles from './StepSheet.module.scss';

export interface StepSheetProps {
  open: boolean;
  stepId: string | null;
  action: IRouteAction | null;
  tenantUid: number;
  stepIndex?: number;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Record<string, unknown>) => void;
  onTypeChange: (type: ActionType) => void;
}

export function isQueueTargetComplete(action: IRouteAction | null | undefined): boolean {
  if (!action || action.type !== 'toqueue') return true;
  return isValueSourceComplete(action.params?.target as ValueSource | undefined);
}

/** @deprecated use isQueueTargetComplete - close is always allowed with confirm */
export function canCloseStepSheet(action: IRouteAction | null): boolean {
  return isQueueTargetComplete(action);
}

function SchemaFields({
  schema,
  params,
  tenantUid,
  showErrors,
  onChange,
}: {
  schema: FieldSchema[];
  params: Record<string, unknown>;
  tenantUid: number;
  showErrors: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();

  return (
    <VStack gap="12" max className={styles.params}>
      {schema.map((field) => {
        const labelFallback =
          field.key === 'target' || field.key === 'queue'
            ? 'Очередь'
            : field.key === 'timeout'
              ? 'Таймаут, сек'
              : field.key === 'options'
                ? 'Опции'
                : field.labelKey;
        const label = t(field.labelKey, labelFallback);
        const hint = field.hintKey ? t(field.hintKey, field.hintKey) : undefined;
        if (field.kind === 'value-source') {
          return (
            <ValueSourceField
              key={field.key}
              value={params[field.key] as ValueSource | undefined}
              onChange={(next) => onChange({ [field.key]: next })}
              tenantUid={tenantUid}
              label={label}
              hint={hint}
              required={field.required}
              optionsSource={field.optionsSource}
              showErrors={showErrors}
            />
          );
        }
        if (field.kind === 'number' || field.kind === 'duration') {
          return (
            <VStack key={field.key} gap="8" max className={styles.field}>
              <Label>{label}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={(params[field.key] as string | number | undefined) ?? ''}
                onChange={(e) =>
                  onChange({
                    [field.key]: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </VStack>
          );
        }
        return (
          <VStack key={field.key} gap="8" max className={styles.field}>
            <Label>{label}</Label>
            <Input
              value={(params[field.key] as string | undefined) ?? ''}
              onChange={(e) => onChange({ [field.key]: e.target.value })}
            />
          </VStack>
        );
      })}
    </VStack>
  );
}

export function StepSheet({
  open,
  stepId,
  action,
  tenantUid,
  stepIndex = 1,
  onOpenChange,
  onChange,
  onTypeChange,
}: StepSheetProps) {
  const { t } = useTranslation();
  const [showErrors, setShowErrors] = useState(false);
  const config = action?.type ? dialplanAppsRegistry[action.type] : undefined;
  const title = config
    ? t(config.labelKey, action?.type ?? '')
    : t('routes.chain.placeholder', 'Выберите действие');
  const queueComplete = isQueueTargetComplete(action);

  useEffect(() => {
    if (open) setShowErrors(false);
  }, [open, stepId]);

  const requestClose = (next: boolean) => {
    if (!next && !queueComplete) {
      setShowErrors(true);
      const ok = window.confirm(
        t(
          'routes.chain.confirmCloseWithoutQueue',
          'Точно закрыть без выбора очереди?',
        ),
      );
      if (!ok) return;
    }
    onOpenChange(next);
  };

  return (
    <Sheet open={open && !!stepId} onOpenChange={requestClose}>
      <SheetContent className={styles.panel}>
        <SheetHeader>
          <SheetTitle>
            <Text variant="h4">{title}</Text>
          </SheetTitle>
          <Text variant="xs">
            {t('routes.chain.stepIndex', 'Шаг {{index}}').replace('{{index}}', String(stepIndex))}
          </Text>
        </SheetHeader>

        <VStack gap="16" className={styles.body}>
          {action ? (
            <ActionTypeSelect
              value={(action.type || '') as ActionType | ''}
              onChange={onTypeChange}
            />
          ) : null}

          {config?.schema?.length ? (
            <VStack gap="12" max className={styles.paramsSection}>
              <HStack gap="4" align="center">
                <Text variant="small">{t('routes.chain.section.params', 'Параметры')}</Text>
                <InfoTooltip
                  text={t(
                    'routes.chain.section.paramsTooltip',
                    '**Статичная очередь** - из списка\n**По маске** - номер набранного exten\n**Из справочника** - по номеру звонящего и полю записи\n**Из переменной** - имя канала без ${}, например MY_QUEUE',
                  )}
                />
              </HStack>
              <SchemaFields
                schema={config.schema}
                params={action?.params ?? {}}
                tenantUid={tenantUid}
                showErrors={showErrors}
                onChange={onChange}
              />
            </VStack>
          ) : (
            <Text variant="muted">
              {t(
                'routes.chain.section.noParams',
                'У этого действия нет параметров, доступны только условия ниже',
              )}
            </Text>
          )}
        </VStack>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => requestClose(false)}>
            {t('routes.chain.closeParams', 'Закрыть')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
