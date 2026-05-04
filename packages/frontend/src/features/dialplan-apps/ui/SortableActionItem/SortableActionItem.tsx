import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button, Text, Tooltip } from '@/shared/ui';
import { VStack, Flex } from '@/shared/ui/Stack';
import { type IRouteAction, type ActionType, type DialStatus } from '@krasterisk/shared';
import { dialplanAppsRegistry } from '../../model/registry';
import { IDialplanAppConfig } from '../../model/types';
import { ActionTypeSelect } from '../ActionTypeSelect';
import { ActionConditionFilters } from '../ActionConditionFilters';

export interface SortableActionItemProps {
  action: IRouteAction;
  idx: number;
  updateAction: (id: string, field: string, value: any) => void;
  removeAction: (id: string) => void;
  AppConfig: IDialplanAppConfig;
}

/**
 * A single sortable action row within the DialplanAppsEditor.
 * Composes ActionTypeSelect, ActionConditionFilters, and the app-specific component.
 * All raw HTML replaced by shared/ui components.
 *
 * @layer features/dialplan-apps
 */
export const SortableActionItem = memo(({
  action, idx, updateAction, removeAction, AppConfig,
}: SortableActionItemProps) => {
  const { t } = useTranslation();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const AppComponent = AppConfig.component;
  const isEmptyType = !action.type;

  const handleTypeChange = useCallback(
    (type: ActionType) => updateAction(action.id, 'type', type),
    [action.id, updateAction],
  );

  const handleDialstatusChange = useCallback(
    (statuses: DialStatus[]) =>
      updateAction(action.id, 'condition.dialstatus', statuses.length > 0 ? statuses : ''),
    [action.id, updateAction],
  );

  const handleTimeGroupChange = useCallback(
    (uid: number | undefined) =>
      updateAction(action.id, 'condition.time_group_uid', uid),
    [action.id, updateAction],
  );

  const handleRemove = useCallback(
    () => removeAction(action.id),
    [action.id, removeAction],
  );

  return (
    <Flex
      ref={setNodeRef}
      style={style}
      direction="row"
      align="start"
      gap="12"
      className={`w-full p-4 bg-black/20 border ${isDragging ? 'border-primary' : 'border-white/10'} rounded-xl backdrop-blur-md transition-colors flex-wrap`}
    >
      {/* Drag Handle */}
      <VStack gap="2" align="center" className="w-[30px] opacity-70 shrink-0">
        <Tooltip content={t('routes.tooltips.dragHandle', 'Перетащите для изменения порядка выполнения')}>
          <Flex
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white transition-colors p-1"
          >
            <GripVertical className="w-5 h-5" />
          </Flex>
        </Tooltip>
        <Text variant="muted">{idx + 1}</Text>
      </VStack>

      {/* Action Type */}
      <VStack gap="2" className="w-[200px] min-w-[140px] shrink-0 max-sm:w-[calc(100%-50px)]">
        <ActionTypeSelect
          value={(action.type || '') as ActionType | ''}
          onChange={handleTypeChange}
        />
      </VStack>

      {/* App-specific Payload */}
      <VStack gap="2" className="flex-1 min-w-[180px] max-sm:w-full max-sm:basis-full">
        {isEmptyType
          ? <Text variant="muted" className="py-2 italic">{t('routes.selectActionHint', 'Выберите действие из списка')}</Text>
          : <AppComponent action={action} onUpdate={updateAction} />
        }
      </VStack>

      {/* Condition Filters */}
      <ActionConditionFilters
        dialstatus={action.condition?.dialstatus}
        timeGroupUid={action.condition?.time_group_uid}
        onDialstatusChange={handleDialstatusChange}
        onTimeGroupChange={handleTimeGroupChange}
        className="w-[220px] min-w-[150px] shrink-0 max-sm:w-full max-sm:basis-full"
      />

      {/* Remove */}
      <Tooltip content={t('common.delete', 'Удалить')}>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 shrink-0"
          onClick={handleRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </Tooltip>
    </Flex>
  );
});

SortableActionItem.displayName = 'SortableActionItem';
