import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { Button } from '@/shared/ui';
import { VStack } from '@/shared/ui/Stack';
import { type IRouteAction, type ActionType } from '@krasterisk/shared';
import { dialplanAppsRegistry } from '../../model/registry';
import { SortableActionItem } from '../SortableActionItem';

/**
 * Dialplan Actions Editor.
 *
 * Slim orchestrator that composes:
 * - SortableActionItem (per action row)
 * - DnD context for drag-and-drop reordering
 *
 * Business logic (add/remove/update/reorder) is handled here.
 * All sub-components are extracted to individual FSD-compliant files.
 *
 * @layer features/dialplan-apps
 */
interface DialplanAppsEditorProps {
  actions: IRouteAction[];
  onChange: (actions: IRouteAction[]) => void;
}

export const DialplanAppsEditor = memo(({ actions, onChange }: DialplanAppsEditorProps) => {
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addAction = useCallback(() => {
    const newAction: IRouteAction = {
      id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: '' as ActionType,
      params: {},
      condition: { dialstatus: '' },
    };
    onChange([...actions, newAction]);
  }, [actions, onChange]);

  const removeAction = useCallback((id: string) => {
    onChange(actions.filter((a) => a.id !== id));
  }, [actions, onChange]);

  const updateAction = useCallback((id: string, field: string, value: any) => {
    onChange(actions.map((a) => {
      if (a.id !== id) return a;
      if (field === 'type') {
        const config = dialplanAppsRegistry[value as ActionType];
        return { ...a, type: value as ActionType, params: config?.defaultParams || {} };
      }
      if (field.startsWith('params.')) {
        const paramKey = field.slice(7);
        return { ...a, params: { ...a.params, [paramKey]: value } };
      }
      if (field.startsWith('condition.')) {
        const condKey = field.slice(10);
        return { ...a, condition: { ...a.condition, [condKey]: value } };
      }
      return a;
    }));
  }, [actions, onChange]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && over) {
      const oldIndex = actions.findIndex((a) => a.id === active.id);
      const newIndex = actions.findIndex((a) => a.id === over.id);
      onChange(arrayMove(actions, oldIndex, newIndex));
    }
  };

  return (
    <VStack gap="12" className="w-full min-w-0 overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={actions.map(a => a.id)} strategy={verticalListSortingStrategy}>
          <VStack gap="12" className="w-full min-w-0">
            {actions.map((action, idx) => {
              const AppConfig = dialplanAppsRegistry[action.type] || dialplanAppsRegistry.hangup;
              return (
                <SortableActionItem
                  key={action.id}
                  action={action}
                  idx={idx}
                  AppConfig={AppConfig}
                  updateAction={updateAction}
                  removeAction={removeAction}
                />
              );
            })}
          </VStack>
        </SortableContext>
      </DndContext>

      <Button variant="outline" size="sm" onClick={addAction} className="w-fit mt-2">
        <Plus className="w-4 h-4 mr-1" />
        {t('routes.addAction', 'Добавить действие')}
      </Button>
    </VStack>
  );
});

DialplanAppsEditor.displayName = 'DialplanAppsEditor';
