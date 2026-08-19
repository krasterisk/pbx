import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Copy,
  GripVertical,
  MoreVertical,
  Power,
  PowerOff,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { DIALPLAN_ACTION_META, type ActionType, type IRouteAction } from '@krasterisk/shared';
import { Badge, Text, Tooltip } from '@/shared/ui';
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
import type { ChainAction } from '../../model/editorReducer';
import styles from './StepRow.module.scss';

export type StepSection = 'params' | 'conditions' | 'options';

export interface StepRowProps {
  action: ChainAction;
  index: number;
  density?: 'compact' | 'comfortable';
  readOnly?: boolean;
  unreachable?: boolean;
  refs?: Record<string, unknown>;
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

function conditionLabel(action: IRouteAction): string | null {
  const dialstatus = action.condition?.dialstatus;
  if (Array.isArray(dialstatus) && dialstatus.length > 0) return dialstatus.join(', ');
  if (typeof dialstatus === 'string' && dialstatus) return dialstatus;
  if (action.condition?.time_group_uid) return 'schedule';
  return null;
}

export const StepRow = memo(function StepRow({
  action,
  index,
  density = 'comfortable',
  readOnly = false,
  unreachable = false,
  refs,
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
  const summary = config?.summarize
    ? config.summarize(action.params ?? {}, t, refs)
    : t(
        'routes.chain.unknown.summary',
        'Неизвестный тип действия. Параметры сохранены и не будут потеряны',
      );
  const cond = conditionLabel(action);
  const enabled = action.enabled ?? true;
  const minHeight = density === 'compact' ? '44px' : '56px';
  const isEmptyType = !action.type;

  const configureLabel = t('routes.chain.configureStep', 'Настроить шаг');
  const duplicateLabel = t('routes.chain.row.duplicate', 'Дублировать действие');
  const copyLabel = t('routes.chain.row.copy', 'Копировать действие');
  const toggleLabel = enabled
    ? t('routes.chain.row.disable', 'Выключить действие')
    : t('routes.chain.row.enable', 'Включить действие');
  const removeLabel = t('common.delete', 'Удалить');
  const moreLabel = t('routes.chain.row.more', 'Ещё действия');
  const dragLabel = t('routes.tooltips.dragHandle', 'Перетащите для изменения порядка выполнения');

  const openParams = () => onOpenStep(action.id, 'params');

  return (
    <Flex
      ref={setNodeRef}
      role="listitem"
      data-testid="step-row"
      data-density={density}
      data-unreachable={unreachable ? 'true' : undefined}
      className={styles.row}
      style={{
        ...style,
        ['--step-min-height' as string]: minHeight,
      }}
      onClick={readOnly ? openParams : undefined}
    >
      {!readOnly ? (
        <Flex
          className={styles.handle}
          {...dragAttributes}
          {...dragListeners}
          aria-label={dragLabel}
          aria-roledescription="sortable"
          title={dragLabel}
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
        role={readOnly || isEmptyType ? undefined : 'button'}
        tabIndex={readOnly || isEmptyType ? undefined : 0}
        onClick={isEmptyType ? undefined : (event) => {
          event.stopPropagation();
          openParams();
        }}
        onKeyDown={isEmptyType ? undefined : (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openParams();
          }
        }}
      >
        {isEmptyType && onTypeChange ? (
          <ActionTypeSelect
            value=""
            allowedTypes={allowedTypes}
            onChange={(type) => onTypeChange(action.id, type)}
          />
        ) : (
          <>
            <Text className={styles.title}>{title}</Text>
            <Text data-testid="step-row-summary" className={styles.summary}>
              {summary}
            </Text>
          </>
        )}
      </VStack>

      <Flex className={styles.badges} gap="4" wrap="wrap">
        {cond ? (
          <Badge
            variant="outline"
            data-testid="step-row-condition-badge"
            className={styles.conditionBadge}
            onClick={(event) => {
              event.stopPropagation();
              onOpenStep(action.id, 'conditions');
            }}
          >
            {cond}
          </Badge>
        ) : null}
        {meta?.terminal === 'always' ? (
          <Badge variant="outline">{t('routes.chain.badge.terminal', 'Завершает цепочку')}</Badge>
        ) : null}
        {meta?.terminal === 'conditional' ? (
          <Badge variant="outline">{t('routes.chain.badge.mayExit', 'Может выйти из цепочки')}</Badge>
        ) : null}
        {!enabled ? (
          <Badge variant="secondary">{t('routes.chain.badge.disabled', 'Выключен')}</Badge>
        ) : null}
      </Flex>

      {!readOnly ? (
        <TableRowActions className={styles.actions}>
          <TableRowAction
            className={styles.actionBtn}
            title={configureLabel}
            aria-label={configureLabel}
            onClick={(event) => {
              event.stopPropagation();
              openParams();
            }}
          >
            <SlidersHorizontal size={16} />
          </TableRowAction>
          <TableRowAction
            className={styles.actionBtn}
            title={duplicateLabel}
            aria-label={duplicateLabel}
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(action.id);
            }}
          >
            <Copy size={16} />
          </TableRowAction>
          <TableRowAction
            className={styles.actionBtn}
            title={toggleLabel}
            aria-label={toggleLabel}
            onClick={(event) => {
              event.stopPropagation();
              onToggleEnabled(action.id);
            }}
          >
            {enabled ? <Power size={16} /> : <PowerOff size={16} />}
          </TableRowAction>
          <TableRowAction
            danger
            className={styles.actionBtn}
            title={removeLabel}
            aria-label={removeLabel}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(action.id);
            }}
          >
            <Trash2 size={16} />
          </TableRowAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <TableRowAction
                className={styles.actionBtn}
                title={moreLabel}
                aria-label={moreLabel}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreVertical size={16} />
              </TableRowAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onCopy(action.id)}
              >
                {copyLabel}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableRowActions>
      ) : null}
    </Flex>
  );
});
