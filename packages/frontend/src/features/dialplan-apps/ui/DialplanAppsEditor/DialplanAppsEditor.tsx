import React, { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button, Select, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { type IRouteAction, type ActionType } from '@krasterisk/shared';
import { dialplanAppsRegistry, ACTION_TYPES_LIST } from '../../model/registry';

const DIALSTATUS_OPTIONS = [
  { value: '', label: 'routes.dialstatus.any' },
  { value: 'CHANUNAVAIL', label: 'routes.dialstatus.chanunavail' },
  { value: 'BUSY', label: 'routes.dialstatus.busy' },
  { value: 'NOANSWER', label: 'routes.dialstatus.noanswer' },
];

/**
 * Sortable Item Helper Component
 */
const SortableActionItem = memo(({
  action, idx, updateAction, removeAction, t, AppConfig
}: { action: IRouteAction, idx: number, updateAction: any, removeAction: any, t: any, AppConfig: any }) => {
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

  // Memoize grouped options to avoid recalculation
  const groupedCategories = useMemo(() => {
    const groups: Record<string, typeof ACTION_TYPES_LIST> = {};
    ACTION_TYPES_LIST.forEach((item) => {
      const cat = item.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, []);

  return (
    <div ref={setNodeRef} style={style}>
      <HStack
        gap="12"
        align="center"
        className={`w-full p-4 bg-black/20 border ${isDragging ? 'border-primary' : 'border-white/10'} rounded-xl backdrop-blur-md transition-colors`}
      >
        {/* Grab Controls */}
        <VStack gap="2" align="center" className="w-[30px] opacity-70">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white transition-colors p-1">
            <GripVertical className="w-5 h-5" />
          </div>
          <Text size="sm" variant="muted">{idx + 1}</Text>
        </VStack>

        {/* Type Selector */}
        <div className="w-[200px] shrink-0">
          <Text size="sm" variant="muted" className="mb-1 block">{t('routes.actionType', 'Действие')}</Text>
          <Select
            value={action.type}
            onChange={(e) => updateAction(action.id, 'type', e.target.value)}
            className="w-full"
          >
            {Object.entries(groupedCategories).map(([category, items]) => (
              <optgroup key={category} label={t(`routes.categories.${category}`, category.toUpperCase())}>
                {items.map(at => (
                  <option key={at.type} value={at.type}>{t(at.labelKey, at.type)}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {/* App Payload Selector */}
        <div className="flex-1">
          <Text size="sm" variant="muted" className="mb-1 block">{t('routes.actionParams', 'Параметры')}</Text>
          <AppComponent action={action} onUpdate={updateAction} />
        </div>

        {/* Condition Filters */}
        <div className="w-[150px] shrink-0">
          <Text size="sm" variant="muted" className="mb-1 block">{t('routes.condition', 'Условие')}</Text>
          <Select
            value={action.condition?.dialstatus || ''}
            onChange={(e) => updateAction(action.id, 'condition.dialstatus', e.target.value)}
            className="w-full"
          >
            {DIALSTATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{t(opt.label, opt.value || 'Любой')}</option>
            ))}
          </Select>
        </div>

        {/* Remove Action */}
        <Button
          variant="ghost"
          size="icon"
          className="mt-6 text-destructive hover:text-destructive/80 hover:bg-destructive/10 shrink-0"
          onClick={() => removeAction(action.id)}
          title={t('common.delete', 'Удалить')}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </HStack>
    </div>
  );
});
SortableActionItem.displayName = 'SortableActionItem';

/**
 * Main Editor
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
      type: 'hangup',
      params: {},
      condition: { dialstatus: '', calendar: '' },
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
    <VStack gap="12" className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={actions.map(a => a.id)} strategy={verticalListSortingStrategy}>
          <VStack gap="12" className="w-full">
            {actions.map((action, idx) => {
              const AppConfig = dialplanAppsRegistry[action.type] || dialplanAppsRegistry.hangup;
              return (
                <SortableActionItem
                  key={action.id}
                  action={action}
                  idx={idx}
                  t={t}
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
