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
} from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
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

export function canCloseStepSheet(action: IRouteAction | null): boolean {
  if (!action || action.type !== 'toqueue') return true;
  return isValueSourceComplete(action.params?.target as ValueSource | undefined);
}

function SchemaFields({
  schema,
  params,
  tenantUid,
  onChange,
}: {
  schema: FieldSchema[];
  params: Record<string, unknown>;
  tenantUid: number;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();

  return (
    <VStack gap="12" className={styles.params}>
      {schema.map((field) => {
        const label = t(field.labelKey, field.labelKey);
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
            />
          );
        }
        if (field.kind === 'number' || field.kind === 'duration') {
          return (
            <VStack key={field.key} gap="8">
              <Label>{label}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={(params[field.key] as string | number | undefined) ?? ''}
                onChange={(e) => onChange({ [field.key]: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </VStack>
          );
        }
        return (
          <VStack key={field.key} gap="8">
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
  const config = action?.type ? dialplanAppsRegistry[action.type] : undefined;
  const title = config
    ? t(config.labelKey, action?.type ?? '')
    : t('routes.chain.placeholder', 'Выберите действие');
  const canClose = canCloseStepSheet(action);

  const requestClose = (next: boolean) => {
    if (!next && !canClose) return;
    onOpenChange(next);
  };

  return (
    <Sheet open={open && !!stepId} onOpenChange={requestClose}>
      <SheetContent
        className={styles.panel}
        onPointerDownOutside={(event) => {
          if (!canClose) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (!canClose) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (!canClose) event.preventDefault();
        }}
      >
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
            <VStack gap="8">
              <Text variant="small">{t('routes.chain.section.params', 'Параметры')}</Text>
              <SchemaFields
                schema={config.schema}
                params={action?.params ?? {}}
                tenantUid={tenantUid}
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
          <Button type="button" variant="outline" disabled={!canClose} onClick={() => requestClose(false)}>
            {t('routes.chain.closeParams', 'Закрыть')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
