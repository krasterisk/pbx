import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
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
} from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { dialplanAppsRegistry } from '../../model/registry';
import { clientStepFieldErrors, resolveClientFieldError } from '../../model/clientStepFieldErrors';
import { splitSchemaFields } from '../../model/splitSchemaFields';
import { CallGroupDialOptionsPanel } from '../CallGroupDialOptionsPanel/CallGroupDialOptionsPanel';
import { ActionTypeSelect } from '../ActionTypeSelect';
import { isValueSourceComplete } from '../ValueSourceField/ValueSourceField';
import { SchemaFields } from '../SchemaFields/SchemaFields';
import { OptionsEditor } from '../OptionsEditor/OptionsEditor';
import { ConditionEditor } from '../ConditionEditor/ConditionEditor';
import { AppCollapsibleSection } from '../AppCollapsibleSection/AppCollapsibleSection';
import { useSchemaRefs } from '../../model/useSchemaRefs';
import { normalizePlaybackParams } from '../../model/schemas/playback';
import type { FieldSchema, OptionsSource } from '../../model/schema.types';
import styles from './StepSheet.module.scss';

const EMPTY_SCHEMA: FieldSchema[] = [];

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
  onConditionChange?: (condition: IRouteAction['condition']) => void;
  fieldErrors?: Record<string, string>;
  forceSide?: StepSheetSide;
  initialSection?: StepSheetSection;
  allowedTypes?: readonly ActionType[];
  returnFocusRef?: RefObject<HTMLElement | null>;
  optionsSlot?: ReactNode;
  conditionsSlot?: ReactNode;
  /** Route extensions for live dial-number preview. */
  previewPatterns?: string[];
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
  onConditionChange,
  fieldErrors,
  forceSide,
  initialSection,
  allowedTypes,
  returnFocusRef,
  optionsSlot,
  conditionsSlot,
  previewPatterns,
}: StepSheetProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const side: StepSheetSide = forceSide ?? (isMobile ? 'bottom' : 'right');
  const [showErrors, setShowErrors] = useState(false);
  const [primaryOpen, setPrimaryOpen] = useState(true);
  const [paramsOpen, setParamsOpen] = useState(initialSection === 'params');
  const [optionsOpen, setOptionsOpen] = useState(initialSection === 'options');
  const [conditionsOpen, setConditionsOpen] = useState(initialSection === 'conditions');
  const bodyRef = useRef<HTMLDivElement>(null);
  const config = action?.type ? dialplanAppsRegistry[action.type] : undefined;
  const schema = config?.schema ?? EMPTY_SCHEMA;
  const catalogSources = useMemo(
    () =>
      Array.from(
        new Set(
          schema
            .map((field) => field.optionsSource)
            .filter((source): source is OptionsSource => source != null),
        ),
      ),
    [schema],
  );
  const schemaRefs = useSchemaRefs(catalogSources);
  const mergedFieldErrors = useMemo(() => {
    const client = clientStepFieldErrors(action);
    const mapped = Object.fromEntries(
      Object.entries(client).map(([key, code]) => [key, resolveClientFieldError(code, t)]),
    );
    return { ...mapped, ...fieldErrors };
  }, [action, fieldErrors, t]);
  const resolvedOptionsSlot =
    optionsSlot
    ?? (action?.type === 'togroup' ? (
      <CallGroupDialOptionsPanel groupUid={String(action.params?.group ?? '')} />
    ) : null);
  const appLabel = config
    ? t(config.labelKey, action?.type ?? '')
    : '';
  const title = appLabel
    ? t('routes.chain.sheetTitle', 'Параметры шага · {{action}}').replace('{{action}}', appLabel)
    : t('routes.chain.sheetTitleEmpty', 'Параметры шага');
  const queueComplete = isQueueTargetComplete(action);

  useEffect(() => {
    if (open) {
      setShowErrors(false);
      setPrimaryOpen(true);
      setParamsOpen(initialSection === 'params');
      setOptionsOpen(initialSection === 'options');
      setConditionsOpen(initialSection === 'conditions');
    }
  }, [open, stepId, initialSection]);

  // Only on open / step / type — not on field edits (those recreate error maps).
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
  }, [open, stepId, action?.type]);

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

  const { primary: primaryRaw, params: paramsRaw } = splitSchemaFields(schema);
  const hidePrimaryLabels = Boolean(config?.primarySection?.hideFieldLabels);
  // Only hide labels that belong to the primary section itself. Coalesced
  // `params`-group fields must keep their own Label (e.g. WebRTC, timeout).
  const primaryFields = hidePrimaryLabels
    ? primaryRaw.map((field) =>
        field.group === 'params' ? field : { ...field, hideLabel: true },
      )
    : primaryRaw;
  const paramFields = paramsRaw;
  const hasPrimary = primaryFields.length > 0;
  const hasParamFields = paramFields.length > 0;
  const optionsValue = typeof action?.params?.options === 'string' ? action.params.options : '';
  const optionFlags = config?.optionFlags ?? [];
  const showDialOptions =
    optionFlags.length > 0
    || (typeof optionsValue === 'string' && optionsValue.length > 0)
    || resolvedOptionsSlot != null;

  // Two «параметры» blocks in one sheet get «Основные» / «Дополнительные» so the
  // titles stay distinguishable; a single block keeps the plain «Параметры».
  const primaryTitle = config?.primarySection
    ? t(config.primarySection.titleKey, config.primarySection.title ?? config.primarySection.titleKey)
    : hasParamFields
      ? t('routes.chain.section.primaryParams', 'Основные параметры')
      : t('routes.chain.section.params', 'Параметры');
  const primaryTooltip = config?.primarySection?.tooltipKey
    ? t(
        config.primarySection.tooltipKey,
        config.primarySection.tooltip ?? config.primarySection.tooltipKey,
      )
    : config?.primarySection?.tooltip;
  const paramsTitle = hasPrimary
    ? t('routes.chain.section.extraParams', 'Дополнительные параметры')
    : t('routes.chain.section.params', 'Параметры');
  const paramsTooltip = config?.paramsSection?.tooltipKey
    ? t(config.paramsSection.tooltipKey, config.paramsSection.tooltip ?? config.paramsSection.tooltipKey)
    : (config?.paramsSection?.tooltip ??
      t(
        'routes.chain.section.extraParamsTooltip',
        'Необязательные настройки шага - можно оставить как есть.\nРаскройте, если нужно поведение сверх основного.',
      ));

  const renderSchema = (fields: FieldSchema[]) => (
    <SchemaFields
      schema={fields}
      params={action?.type === 'playback'
        ? normalizePlaybackParams(action?.params ?? {})
        : action?.params ?? {}}
      tenantUid={tenantUid}
      previewPatterns={previewPatterns}
      showErrors={showErrors}
      fieldErrors={mergedFieldErrors}
      refs={schemaRefs}
      onChange={onChange}
    />
  );

  return (
    <Sheet open={open && !!stepId} onOpenChange={requestClose}>
      <SheetContent
        side={side}
        className={`${styles.panel} ${side === 'bottom' ? styles.panelBottom : ''}`}
      >
        <SheetHeader>
          <SheetTitle>
            <Text variant="h4">{title}</Text>
          </SheetTitle>
          <Text variant="xs">
            {t('routes.chain.stepIndex', 'Шаг {{index}}').replace('{{index}}', String(stepIndex))}
          </Text>
        </SheetHeader>

        {/* scrollBody exception: native div required for flex min-height shrink (ARCHITECTURE.md) */}
        <div
          ref={bodyRef}
          data-testid="step-sheet-body"
          className={styles.body}
        >
          <VStack gap="16" max>
            {action ? (
              <ActionTypeSelect
                value={(action.type || '') as ActionType | ''}
                onChange={onTypeChange}
                allowedTypes={allowedTypes}
              />
            ) : null}

            {hasPrimary ? (
              <AppCollapsibleSection
                title={primaryTitle}
                open={primaryOpen}
                onToggle={() => setPrimaryOpen((v) => !v)}
                tooltip={
                  primaryTooltip ??
                  t(
                    'routes.chain.section.primaryTooltip',
                    'Основные настройки шага: куда направить вызов и связанные поля.\nЗаполните обязательные - иначе шаг не сработает.',
                  )
                }
              >
                {renderSchema(primaryFields)}
              </AppCollapsibleSection>
            ) : (
              <Text variant="muted">
                {t(
                  'routes.chain.section.noParams',
                  'У этого действия нет параметров, доступны только условия ниже',
                )}
              </Text>
            )}

            {hasParamFields ? (
              <AppCollapsibleSection
                title={paramsTitle}
                open={paramsOpen}
                onToggle={() => setParamsOpen((v) => !v)}
                tooltip={paramsTooltip}
              >
                {renderSchema(paramFields)}
              </AppCollapsibleSection>
            ) : null}

            {showDialOptions ? (
              <AppCollapsibleSection
                title={t('routes.chain.section.options', 'Опции')}
                open={optionsOpen}
                onToggle={() => setOptionsOpen((v) => !v)}
                tooltip={t(
                  'routes.chain.section.optionsTooltip',
                  'Флаги набора: перевод, сброс, музыка ожидания и другие.\nВлияют на поведение Dial/Queue, не на номер назначения.',
                )}
              >
                {resolvedOptionsSlot ?? (
                  <OptionsEditor
                    value={optionsValue}
                    flags={optionFlags}
                    onChange={(options) => onChange({ options })}
                    embedded
                  />
                )}
              </AppCollapsibleSection>
            ) : null}

            <AppCollapsibleSection
              title={t('routes.chain.section.conditions', 'Условия')}
              open={conditionsOpen}
              onToggle={() => setConditionsOpen((v) => !v)}
              tooltip={t(
                'routes.chain.section.conditionsTooltip',
                'Когда выполнять этот шаг по результату предыдущего (набор или очередь).\nБез условия - всегда.\nРасписание - по группе времени.',
              )}
            >
              {conditionsSlot ?? (
                <ConditionEditor
                  condition={action?.condition}
                  onChange={(next) => onConditionChange?.(next)}
                />
              )}
            </AppCollapsibleSection>
          </VStack>
        </div>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => requestClose(false)}>
            {t('routes.chain.close', 'Закрыть')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
