import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ListPlus, Plus } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DIALPLAN_ACTION_META,
  type ActionType,
  type IRouteAction,
} from '@krasterisk/shared';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, Text, Tooltip } from '@/shared/ui';
import { Flex, VStack } from '@/shared/ui/Stack';
import { selectCurrentUser } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { copyStep, hasStep } from '../../model/clipboard';
import {
  editorReducer,
  type EditorAction,
  type EditorState,
  type RemovedEntry,
} from '../../model/editorReducer';
import { dialplanAppsRegistry } from '../../model/registry';
import type { DialplanHost } from '../../model/types';
import { StepRow, type StepSection } from '../StepRow/StepRow';
import { StepSheet } from '../StepSheet/StepSheet';
import { UnknownActionCard } from '../UnknownActionCard/UnknownActionCard';
import styles from './DialplanAppsEditor.module.scss';

export interface DialplanAppsEditorProps {
  actions: IRouteAction[];
  onChange: (actions: IRouteAction[]) => void;
  readOnly?: boolean;
  labels?: {
    emptyTitle?: string;
    emptyBody?: string;
    namespace?: string;
  };
  allowedTypes?: ActionType[];
  density?: 'compact' | 'comfortable';
  maxSteps?: number;
  host?: DialplanHost;
  makeId?: () => string;
}

export function restrictToVerticalAxisLocal({
  transform,
}: {
  transform: { x: number; y: number; scaleX: number; scaleY: number };
}) {
  return { ...transform, x: 0 };
}

export function buildDndAnnouncements(
  t: (key: string, fallback?: any) => string,
  lang: string,
  getIndex?: (id: string | number) => number,
): Announcements {
  const isEn = lang.toLowerCase().startsWith('en');
  const positionOf = (id?: string | number) => {
    if (id == null) return 1;
    const found = getIndex?.(id);
    return (found ?? 0) + 1;
  };

  return {
    onDragStart: ({ active }) =>
      isEn
        ? t('routes.chain.dnd.picked', 'Step picked')
        : t('routes.chain.dnd.picked', 'Шаг поднят'),
    onDragOver: ({ over }) => {
      const n = positionOf(over?.id);
      return isEn
        ? t('routes.chain.dnd.moved', 'Moved to position {{n}}').replace('{{n}}', String(n))
        : t('routes.chain.dnd.moved', 'Перемещён на позицию {{n}}').replace('{{n}}', String(n));
    },
    onDragEnd: ({ over }) =>
      over
        ? isEn
          ? t('routes.chain.dnd.dropped', 'Step dropped')
          : t('routes.chain.dnd.dropped', 'Шаг отпущен')
        : undefined,
    onDragCancel: () =>
      isEn
        ? t('routes.chain.dnd.cancelled', 'Move cancelled')
        : t('routes.chain.dnd.cancelled', 'Перемещение отменено'),
  };
}

function typesForHost(host: DialplanHost): ActionType[] {
  return (Object.keys(DIALPLAN_ACTION_META) as ActionType[]).filter((type) =>
    DIALPLAN_ACTION_META[type].allowedIn.includes(host),
  );
}

function firstAlwaysTerminalIndex(actions: IRouteAction[]): number {
  return actions.findIndex((action) => {
    if (!action.type) return false;
    return DIALPLAN_ACTION_META[action.type]?.terminal === 'always';
  });
}

function SortableStepRow(
  props: React.ComponentProps<typeof StepRow> & { id: string },
) {
  const { id, style, ...rest } = props;
  const sortable = useSortable({ id });
  return (
    <StepRow
      {...rest}
      setNodeRef={sortable.setNodeRef}
      dragListeners={sortable.listeners as unknown as Record<string, unknown>}
      dragAttributes={sortable.attributes as unknown as Record<string, unknown>}
      style={{
        ...style,
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.6 : 1,
      }}
    />
  );
}

export const DialplanAppsEditor = memo(function DialplanAppsEditor({
  actions,
  onChange,
  readOnly = false,
  labels,
  allowedTypes,
  density = 'comfortable',
  maxSteps,
  host = 'route',
  makeId = () => crypto.randomUUID(),
}: DialplanAppsEditorProps) {
  const { t, i18n } = useTranslation();
  const currentUser = useAppSelector(selectCurrentUser);
  const tenantUid = currentUser?.vpbx_user_uid ?? 0;
  const [removedStack, setRemovedStack] = useState<RemovedEntry[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [, setSelectedSection] = useState<StepSection>('params');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const undoTimer = useRef<number | null>(null);

  const resolvedAllowed = allowedTypes ?? typesForHost(host);
  const atLimit = maxSteps != null && actions.length >= maxSteps;
  const terminalIndex = firstAlwaysTerminalIndex(actions);
  const unreachableCount =
    terminalIndex >= 0 ? Math.max(0, actions.length - terminalIndex - 1) : 0;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const apply = useCallback(
    (action: EditorAction) => {
      const state: EditorState = { actions, removedStack, selectedStepId };
      const next = editorReducer(state, action, makeId);
      setRemovedStack(next.removedStack);
      setSelectedStepId(next.selectedStepId);
      if (next.actions !== actions) onChange(next.actions);
      return next;
    },
    [actions, makeId, onChange, removedStack, selectedStepId],
  );

  const addAction = useCallback(() => {
    if (readOnly || atLimit) return;
    const id = makeId();
    apply({
      type: 'insertAt',
      index: actions.length,
      action: {
        id,
        type: '' as ActionType,
        params: {},
        condition: { dialstatus: '' },
        enabled: true,
      },
    });
    setSelectedStepId(id);
  }, [actions.length, apply, atLimit, makeId, readOnly]);

  const handleTypeChange = useCallback(
    (id: string, type: ActionType) => {
      const config = dialplanAppsRegistry[type];
      apply({ type: 'setType', id, actionType: type, defaultParams: config?.defaultParams });
      setSelectedStepId(id);
      setSelectedSection('params');
    },
    [apply],
  );

  const announcements = useMemo(
    () =>
      buildDndAnnouncements(t, i18n?.language ?? 'ru', (id) =>
        actions.findIndex((item) => item.id === String(id)),
      ),
    [actions, i18n?.language, t],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = actions.findIndex((item) => item.id === active.id);
    const to = actions.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    apply({ type: 'move', from, to });
  };

  const selectedAction = actions.find((item) => item.id === selectedStepId) ?? null;
  const selectedIndex = selectedAction
    ? actions.findIndex((item) => item.id === selectedAction.id) + 1
    : 1;
  const activeAction = actions.find((item) => item.id === activeId) ?? null;
  const addLabel = t('routes.addAction', 'Добавить действие');
  const limitTooltip = t('routes.chain.limitReached', 'Достигнут предел: {{max}} действий').replace(
    '{{max}}',
    String(maxSteps ?? 0),
  );

  const showUndo = () => {
    setUndoVisible(true);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoVisible(false), 10_000);
  };

  return (
    <VStack gap="12" className={styles.root}>
      {readOnly ? (
        <Text variant="muted" className={styles.readOnlyBar}>
          {t('routes.chain.readOnly', 'Просмотр без изменений')}
        </Text>
      ) : null}

      {undoVisible && removedStack.length > 0 && !readOnly ? (
        <Flex className={styles.undoBar} justify="between" align="center">
          <Text>{t('routes.chain.undo.deleted', 'Действие удалено')}</Text>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              apply({ type: 'undoRemove' });
              setUndoVisible(false);
            }}
          >
            {t('routes.chain.undo.restore', 'Вернуть шаг')}
          </Button>
        </Flex>
      ) : null}

      {unreachableCount > 0 ? (
        <Flex className={styles.unreachable} gap="8" align="start">
          <AlertTriangle size={16} />
          <VStack gap="4">
            <Text>
              {unreachableCount === 1
                ? t('routes.chain.unreachable.title_one', 'Шаг ниже не выполнится')
                : t('routes.chain.unreachable.title_other', 'Шаги ниже не выполнятся')}
            </Text>
            <Text variant="muted">
              {(unreachableCount === 1
                ? t(
                    'routes.chain.unreachable.body_one',
                    'Действие {{index}} завершает цепочку. Перенесите его вниз или удалите действие после него',
                  )
                : t(
                    'routes.chain.unreachable.body_other',
                    'Действие {{index}} завершает цепочку. Перенесите его вниз или удалите действия после него',
                  )
              ).replace('{{index}}', String(terminalIndex + 1))}
            </Text>
          </VStack>
        </Flex>
      ) : null}

      {actions.length === 0 ? (
        <VStack gap="12" align="center" className={styles.empty}>
          <ListPlus size={28} className={styles.emptyIcon} data-testid="chain-empty-icon" />
          <Text variant="h4">
            {labels?.emptyTitle ?? t('routes.chain.empty.title', 'Цепочка действий пуста')}
          </Text>
          <Text variant="muted">
            {labels?.emptyBody
              ?? t(
                'routes.chain.empty.bodyRoute',
                'Добавьте первое действие: звонок в очередь, на внутренний номер, в IVR или уведомление',
              )}
          </Text>
          {!readOnly ? (
            <Button type="button" onClick={addAction}>
              {addLabel}
            </Button>
          ) : (
            <Text variant="muted">{t('routes.chain.empty.readOnly', 'Действий нет')}</Text>
          )}
        </VStack>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxisLocal]}
          accessibility={{ announcements }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={actions.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <VStack gap="8" className={styles.list} role="list">
              {actions.map((action, idx) => (
                <VStack key={action.id} gap="0" max>
                  <SortableStepRow
                    id={action.id}
                    action={action}
                    index={idx}
                    density={density}
                    readOnly={readOnly}
                    unreachable={terminalIndex >= 0 && idx > terminalIndex}
                    allowedTypes={resolvedAllowed}
                    onOpenStep={(id, section) => {
                      setSelectedStepId(id);
                      setSelectedSection(section ?? 'params');
                    }}
                    onDuplicate={(id) => apply({ type: 'duplicate', id })}
                    onToggleEnabled={(id) => apply({ type: 'toggleEnabled', id })}
                    onRemove={(id) => {
                      apply({ type: 'remove', id });
                      showUndo();
                    }}
                    onCopy={(id) => {
                      const current = actions.find((item) => item.id === id);
                      if (current) copyStep(current);
                    }}
                    onTypeChange={handleTypeChange}
                  />
                  {!readOnly && idx < actions.length - 1 ? (
                    <Flex className={styles.gap}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={styles.gapButton}
                        title={t('routes.chain.insertHere', 'Вставить действие сюда')}
                        aria-label={t('routes.chain.insertHere', 'Вставить действие сюда')}
                        disabled={atLimit}
                        onClick={() => {
                          const id = makeId();
                          apply({
                            type: 'insertAt',
                            index: idx + 1,
                            action: {
                              id,
                              type: '' as ActionType,
                              params: {},
                              condition: {},
                              enabled: true,
                            },
                          });
                          setSelectedStepId(id);
                        }}
                      >
                        <Plus size={16} />
                      </Button>
                    </Flex>
                  ) : null}
                </VStack>
              ))}
            </VStack>
          </SortableContext>
          <DragOverlay>
            {activeAction ? (
              <StepRow
                action={activeAction}
                index={actions.findIndex((item) => item.id === activeAction.id)}
                density={density}
                onOpenStep={() => undefined}
                onDuplicate={() => undefined}
                onToggleEnabled={() => undefined}
                onRemove={() => undefined}
                onCopy={() => undefined}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {!readOnly && actions.length > 0 ? (
        <Flex className={styles.footer} gap="8" align="center">
          <Tooltip content={atLimit ? limitTooltip : t('routes.chain.orderHint', 'Действия выполняются сверху вниз')}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAction}
              disabled={atLimit}
              aria-label={addLabel}
            >
              <Plus size={16} />
              {addLabel}
            </Button>
          </Tooltip>
          {maxSteps != null ? (
            <Text className={styles.counter}>{`${actions.length} / ${maxSteps}`}</Text>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasStep() || atLimit}
            title={t('routes.chain.pasteCopied', 'Вставить скопированный шаг')}
            onClick={() => apply({ type: 'paste', index: actions.length })}
          >
            {t('routes.chain.pasteCopied', 'Вставить скопированный шаг')}
          </Button>
        </Flex>
      ) : null}

      {isUnknownType(selectedAction) ? (
        <Sheet
          open={!!selectedStepId && !!selectedAction}
          onOpenChange={(next) => {
            if (!next) setSelectedStepId(null);
          }}
        >
          <SheetContent>
            <SheetHeader>
              <SheetTitle>
                <Text variant="h4">
                  {t('routes.chain.badge.unknown', 'Неизвестное действие')}
                </Text>
              </SheetTitle>
            </SheetHeader>
            {selectedAction ? (
              <UnknownActionCard
                type={selectedAction.type}
                params={selectedAction.params ?? {}}
                onDelete={() => {
                  apply({ type: 'remove', id: selectedAction.id });
                  setSelectedStepId(null);
                }}
                onReplaceType={(type) => handleTypeChange(selectedAction.id, type)}
              />
            ) : null}
          </SheetContent>
        </Sheet>
      ) : (
        <StepSheet
          open={!!selectedStepId && !!selectedAction && !isEmptyType(selectedAction)}
          stepId={selectedStepId}
          action={selectedAction}
          tenantUid={tenantUid}
          stepIndex={selectedIndex}
          onOpenChange={(next) => {
            if (!next) setSelectedStepId(null);
          }}
          onChange={(patch) => {
            if (selectedStepId) apply({ type: 'patchParams', id: selectedStepId, patch });
          }}
          onTypeChange={(type) => {
            if (selectedStepId) handleTypeChange(selectedStepId, type);
          }}
        />
      )}
    </VStack>
  );
});

function isEmptyType(action: IRouteAction | null): boolean {
  return !action?.type;
}

function isUnknownType(action: IRouteAction | null): boolean {
  return Boolean(action?.type && !dialplanAppsRegistry[action.type]);
}

DialplanAppsEditor.displayName = 'DialplanAppsEditor';
