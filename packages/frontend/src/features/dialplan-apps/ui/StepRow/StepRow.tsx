import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Copy,
  GripVertical,
  MoreVertical,
  Power,
  PowerOff,
  Info,
  Trash2,
} from 'lucide-react';
import {
  DIALPLAN_ACTION_META,
  type ActionType,
  type IRouteAction,
  type ITemplateSlot,
} from '@krasterisk/shared';
import { Button, Tooltip, Text } from '@/shared/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui';
import { Flex, VStack } from '@/shared/ui/Stack';
import { TableRowAction, TableRowActions } from '@/shared/ui/TableRowActions';
import { ActionTypeSelect } from '../ActionTypeSelect';
import { dialplanAppsRegistry } from '../../model/registry';
import { toConditionSource } from '../../model/conditionMap';
import type { ChainAction } from '../../model/editorReducer';
import { sanitizeParamsForPreview } from '@/features/route-templates/model/sanitizeParamsForPreview';
import { stripActionTitleFromSummary } from '../../model/stripActionTitleFromSummary';
import styles from './StepRow.module.scss';

export type StepSection = 'params' | 'conditions' | 'options';

export interface StepRowProps {
  action: ChainAction;
  index: number;
  density?: 'compact' | 'comfortable';
  readOnly?: boolean;
  unreachable?: boolean;
  refs?: Record<string, unknown>;
  slots?: ITemplateSlot[];
  allowedTypes?: ActionType[];
  dragListeners?: Record<string, unknown>;
  dragAttributes?: Record<string, unknown>;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  onOpenStep: (id: string, section?: StepSection) => void;
  onDuplicate: (id: string) => void;
  onToggleEnabled: (id: string) => void;
  onRemove: (id: string) => void;
  onCopy: (id: string) => void;
  onPasteBetween?: (index: number) => void;
  onTypeChange?: (id: string, type: ActionType) => void;
}

function conditionLabel(
  action: IRouteAction,
  t: (key: string, fallback: string) => string,
): string | null {
  const source = toConditionSource(action.condition);
  const details: string[] = [];
  if (source) {
    if (
      source.source === 'dialstatus' ||
      source.source === 'queuestatus' ||
      source.source === 'record_status'
    ) {
      const group =
        source.source === 'dialstatus'
          ? 'dial'
          : source.source === 'queuestatus'
            ? 'queue'
            : 'record';
      const statuses = source.values
        .map((value) =>
          t(
            'routes.chain.conditions.' + group + '.' + value.toLowerCase(),
            value,
          ),
        )
        .join(', ');
      details.push(
        t(
          'routes.chain.row.conditionHint',
          'Условие по результату звонка: {{status}}',
        ).replace('{{status}}', statuses),
      );
    } else details.push(t('routes.chain.row.conditions', 'Условия выполнения'));
  }
  if (action.condition?.time_group_uid)
    details.push(t('routes.chain.row.scheduleHint', 'Условие по расписанию'));
  return details.length ? details.join('\n') : null;
}

export const StepRow = memo(function StepRow({
  action,
  index,
  density = 'comfortable',
  readOnly = false,
  unreachable = false,
  refs,
  slots = [],
  allowedTypes,
  dragListeners,
  dragAttributes,
  setNodeRef,
  style,
  onOpenStep,
  onDuplicate,
  onToggleEnabled,
  onRemove,
  onCopy,
  onTypeChange,
}: StepRowProps) {
  const { t } = useTranslation();
  const config = action.type ? dialplanAppsRegistry[action.type] : undefined;
  const meta = action.type ? DIALPLAN_ACTION_META[action.type] : undefined;
  const title = config
    ? t(config.labelKey, action.type)
    : action.type || t('routes.chain.placeholder', 'Выберите действие');
  const rawSummary = config?.summarize
    ? config.summarize(
        sanitizeParamsForPreview(action.params ?? {}, slots),
        t,
        refs,
      )
    : t(
        'routes.chain.unknown.summary',
        'Неизвестный тип действия. Параметры сохранены и не будут потеряны',
      );
  const summary = stripActionTitleFromSummary(title, rawSummary);
  const cond = conditionLabel(action, t);
  const terminal =
    action.type === 'directory_lookup' &&
    !['drop', 'redirect', 'custom'].includes(String(action.params?.behavior))
      ? 'never'
      : meta?.terminal;
  const enabled = action.enabled ?? true;
  const [infoOpen, setInfoOpen] = useState(false);
  const infoLabel = t('routes.chain.row.info', 'Информация о шаге');
  const statuses: string[] = [];
  if (cond) statuses.push(cond);
  if (!enabled) statuses.push(t('routes.chain.badge.disabled', 'Выключен'));
  else if (terminal === 'always') statuses.push(t('routes.chain.badge.terminal', 'Завершает цепочку'));
  else if (terminal === 'conditional') statuses.push(t('routes.chain.badge.mayExit', 'Может выйти из цепочки'));
  if (unreachable) statuses.push(t('routes.chain.row.unreachableHint', 'Шаг не выполнится: предыдущее действие завершает цепочку'));
  const minHeight = density === 'compact' ? '44px' : '56px';
  const isEmptyType = !action.type;
  const isUnknown = Boolean(action.type && !config);
  if (isUnknown) statuses.push(t("routes.chain.badge.unknown", "Неизвестное действие"));
  if (action.type && allowedTypes && !allowedTypes.includes(action.type)) statuses.push(t("routes.chain.badge.notAllowed", "Недоступно в этом контексте"));

  const duplicateLabel = t(
    'routes.chain.row.duplicate',
    'Дублировать действие',
  );
  const copyLabel = t('routes.chain.row.copy', 'Копировать действие');
  const toggleLabel = enabled
    ? t('routes.chain.row.disable', 'Выключить действие')
    : t('routes.chain.row.enable', 'Включить действие');
  const removeLabel = t('common.delete', 'Удалить');
  const moreLabel = t('routes.chain.row.more', 'Ещё действия');
  const dragLabel = t(
    'routes.tooltips.dragHandle',
    'Перетащите для изменения порядка выполнения',
  );

  const openParams = () => onOpenStep(action.id, 'params');

  return (
    <Flex
      ref={setNodeRef}
      role="listitem"
      data-testid="step-row"
      data-density={density}
      data-unreachable={unreachable ? 'true' : undefined}
      data-unknown={isUnknown ? 'true' : undefined}
      className={styles.row}
      style={{
        ...style,
        ['--step-min-height' as string]: minHeight,
      }}
      onClick={isEmptyType ? undefined : openParams}
    >
      {!readOnly ? (
        <Flex
          className={styles.handle}
          {...dragAttributes}
          {...dragListeners}
          aria-label={dragLabel}
          aria-roledescription="sortable"
          title={dragLabel}
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical size={20} />
        </Flex>
      ) : (
        <Flex className={styles.handle} aria-hidden>
          {' '}
        </Flex>
      )}

      <Text variant="muted" className={styles.number} aria-hidden>
        {index + 1}
      </Text>

      <VStack
        gap="4"
        className={styles.main}
        aria-label={title}
        role={isEmptyType ? undefined : 'button'}
        tabIndex={isEmptyType ? undefined : 0}
        onClick={
          isEmptyType
            ? undefined
            : (event) => {
                event.stopPropagation();
                openParams();
              }
        }
        onKeyDown={
          isEmptyType
            ? undefined
            : (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openParams();
                }
              }
        }
      >
        {isEmptyType && onTypeChange ? (
          <ActionTypeSelect
            value=""
            allowedTypes={allowedTypes}
            onChange={(type) => onTypeChange(action.id, type)}
          />
        ) : (
          <>
            <Flex gap="6" align="center">
              <Text className={isUnknown ? styles.unknownType : styles.title}>
                {title}
              </Text>
            </Flex>
            {summary ? (
              <Text data-testid="step-row-summary" className={styles.summary}>
                {summary}
              </Text>
            ) : null}
          </>
        )}
      </VStack>

      <Flex className={styles.badges} gap="4">
        {statuses.length > 0 && (
          <Tooltip content={statuses.join("\n")} open={infoOpen} onOpenChange={setInfoOpen}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={styles.statusIcon}
              aria-label={infoLabel}
              data-testid="step-row-info"
              onClick={(event) => {
                event.stopPropagation();
                setInfoOpen(true);
              }}
            >
              <Info size={16} />
            </Button>
          </Tooltip>
        )}
      </Flex>
      {!readOnly ? (
        <TableRowActions className={styles.actions}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <TableRowAction
                className={styles.actionBtn}
                aria-label={moreLabel}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreVertical size={18} />
              </TableRowAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenuItem
                disabled={isUnknown}
                onClick={() => onDuplicate(action.id)}
              >
                <Copy size={16} />
                {duplicateLabel}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCopy(action.id)}>
                <Copy size={16} />
                {copyLabel}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isUnknown}
                onClick={() => onToggleEnabled(action.id)}
              >
                {enabled ? <Power size={16} /> : <PowerOff size={16} />}{' '}
                {toggleLabel}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={styles.dangerItem}
                onClick={() => onRemove(action.id)}
              >
                <Trash2 size={16} />
                {removeLabel}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableRowActions>
      ) : null}
    </Flex>
  );
});
