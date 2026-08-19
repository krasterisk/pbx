import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, IRouteAction, ValueSource } from '@krasterisk/shared';
import {
  Button,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Text,
  InfoTooltip,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { dialplanAppsRegistry } from '../../model/registry';
import { ActionTypeSelect } from '../ActionTypeSelect';
import { isValueSourceComplete } from '../ValueSourceField/ValueSourceField';
import { SchemaFields } from '../SchemaFields/SchemaFields';
import { OptionsEditor } from '../OptionsEditor/OptionsEditor';
import styles from './StepSheet.module.scss';

export type StepSheetSide = 'right' | 'bottom';
export type StepSheetSection = 'params' | 'options' | 'conditions';

export interface StepSheetProps {
  open: boolean;
  stepId: string | null;
  action: IRouteAction | null;
  tenantUid: number;
  stepIndex?: number;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Record<string, unknown>) => void;
  onTypeChange: (type: ActionType) => void;
  fieldErrors?: Record<string, string>;
  forceSide?: StepSheetSide;
  initialSection?: StepSheetSection;
  allowedTypes?: readonly ActionType[];
  returnFocusRef?: RefObject<HTMLElement | null>;
  optionsSlot?: ReactNode;
  conditionsSlot?: ReactNode;
}

export function isQueueTargetComplete(action: IRouteAction | null | undefined): boolean {
  if (!action || action.type !== 'toqueue') return true;
  return isValueSourceComplete(action.params?.target as ValueSource | undefined);
}

/** @deprecated use isQueueTargetComplete - close is always allowed with confirm */
export function canCloseStepSheet(action: IRouteAction | null): boolean {
  return isQueueTargetComplete(action);
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
  fieldErrors,
  forceSide,
  initialSection,
  allowedTypes,
  returnFocusRef,
  optionsSlot,
  conditionsSlot,
}: StepSheetProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const side: StepSheetSide = forceSide ?? (isMobile ? 'bottom' : 'right');
  const [showErrors, setShowErrors] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(initialSection === 'conditions');
  const bodyRef = useRef<HTMLDivElement>(null);
  const config = action?.type ? dialplanAppsRegistry[action.type] : undefined;
  const title = config
    ? t(config.labelKey, action?.type ?? '')
    : t('routes.chain.placeholder', 'Выберите действие');
  const queueComplete = isQueueTargetComplete(action);

  useEffect(() => {
    if (open) setShowErrors(false);
  }, [open, stepId]);

  useEffect(() => {
    if (initialSection === 'conditions') setConditionsOpen(true);
    if (initialSection === 'options') setOptionsOpen(true);
  }, [initialSection, open, stepId]);

  useEffect(() => {
    if (!open) return;
    const root = bodyRef.current;
    if (!root) return;
    const invalid = root.querySelector<HTMLElement>('[aria-invalid="true"]');
    const editable = root.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );
    const target = invalid ?? editable;
    target?.focus();
  }, [open, stepId, action?.type, fieldErrors]);

  const requestClose = (next: boolean) => {
    if (!next && !queueComplete) {
      setShowErrors(true);
      const ok = window.confirm(
        t('routes.chain.confirmCloseWithoutQueue', 'Точно закрыть без выбора очереди?'),
      );
      if (!ok) return;
    }
    onOpenChange(next);
    if (!next) {
      returnFocusRef?.current?.focus();
    }
  };

  const hasParams = Boolean(config?.schema?.length);
  const optionsValue = typeof action?.params?.options === 'string' ? action.params.options : '';
  const optionFlags = config?.optionFlags ?? [];
  const showOptions = optionFlags.length > 0 || optionsValue.length > 0;

  return (
    <Sheet open={open && !!stepId} onOpenChange={requestClose}>
      <SheetContent
        side={side}
        className={`${styles.panel} ${side === 'bottom' ? styles.panelBottom : ''}`}
        style={side === 'bottom' ? { maxHeight: '85dvh' } : undefined}
      >
        <SheetHeader>
          <SheetTitle>
            <Text variant="h4">{title}</Text>
          </SheetTitle>
          <Text variant="xs">
            {t('routes.chain.stepIndex', 'Шаг {{index}}').replace('{{index}}', String(stepIndex))}
          </Text>
        </SheetHeader>

        <div
          ref={bodyRef}
          data-testid="step-sheet-body"
          className={styles.body}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}
        >
        <VStack gap="16">
          {action ? (
            <ActionTypeSelect
              value={(action.type || '') as ActionType | ''}
              onChange={onTypeChange}
              allowedTypes={allowedTypes}
            />
          ) : null}

          {hasParams ? (
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
                schema={config?.schema ?? []}
                params={action?.params ?? {}}
                tenantUid={tenantUid}
                showErrors={showErrors}
                fieldErrors={fieldErrors}
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

          {showOptions || optionsSlot != null ? (
            <VStack gap="8" max className={styles.collapsible}>
              <button
                type="button"
                className={styles.groupToggle}
                aria-expanded={optionsOpen}
                onClick={() => setOptionsOpen((v) => !v)}
              >
                {t('routes.chain.section.options', 'Опции')}
              </button>
              {optionsOpen
                ? (optionsSlot ?? (
                    <OptionsEditor
                      value={optionsValue}
                      flags={optionFlags}
                      onChange={(options) => onChange({ options })}
                    />
                  ))
                : null}
            </VStack>
          ) : null}

          {conditionsSlot != null ? (
            <VStack gap="8" max className={styles.collapsible}>
              <button
                type="button"
                className={styles.groupToggle}
                aria-expanded={conditionsOpen}
                onClick={() => setConditionsOpen((v) => !v)}
              >
                {t('routes.chain.section.conditions', 'Условия')}
              </button>
              {conditionsOpen ? conditionsSlot : null}
            </VStack>
          ) : null}
        </VStack>
        </div>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => requestClose(false)}>
            {t('routes.chain.closeParams', 'Закрыть параметры')}
          </Button>
          <Text variant="muted">
            {t(
              'routes.chain.liveHint',
              'Изменения применяются сразу. Сохранение - в форме маршрута',
            )}
          </Text>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
