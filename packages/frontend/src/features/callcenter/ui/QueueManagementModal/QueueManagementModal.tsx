import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical, Plus, Minus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Text,
} from '@/shared/ui';
import {
  useSupervisorQueueAddMutation,
  useSupervisorQueueRemoveMutation,
  useSupervisorQueuePenaltyMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import type { IAgent, IQueueStats } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './QueueManagementModal.module.scss';

const DROP_IN = 'drop-in-queue';
const DROP_AVAILABLE = 'drop-available';

export interface QueueManagementModalProps {
  agent: IAgent | null;
  open: boolean;
  onClose: () => void;
}

function queueLabel(q: IQueueStats): string {
  return q.displayName || q.name;
}

interface QueueCardProps {
  queue: IQueueStats;
  mode: 'in' | 'available';
  penalty?: number;
  onPenaltyChange?: (value: number) => void;
  onPenaltyCommit?: (value: number) => void;
  onAdd?: () => void;
  onRemove?: () => void;
  addLabel: string;
  removeLabel: string;
  penaltyLabel: string;
}

function QueueCard({
  queue,
  mode,
  penalty,
  onPenaltyChange,
  onPenaltyCommit,
  onAdd,
  onRemove,
  addLabel,
  removeLabel,
  penaltyLabel,
}: QueueCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: queue.name,
    data: { queue: queue.name, mode },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.card} ${isDragging ? styles.cardDragging : ''}`}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="w-3.5 h-3.5 opacity-40 shrink-0" />
      <span className={styles.cardName}>{queueLabel(queue)}</span>
      {mode === 'in' && (
        <div className={styles.penaltyWrap} onPointerDown={(e) => e.stopPropagation()}>
          <span className={styles.penaltyLabel}>{penaltyLabel}</span>
          <input
            type="number"
            className={styles.penaltyInput}
            value={penalty ?? 0}
            min={0}
            onChange={(e) => onPenaltyChange?.(Number(e.target.value))}
            onBlur={(e) => onPenaltyCommit?.(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            aria-label={penaltyLabel}
          />
        </div>
      )}
      <div className={styles.cardActions} onPointerDown={(e) => e.stopPropagation()}>
        {mode === 'available' ? (
          <Button type="button" variant="outline" size="sm" onClick={onAdd} title={addLabel}>
            <Plus className="w-3.5 h-3.5" />
            {addLabel}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onRemove} title={removeLabel}>
            <Minus className="w-3.5 h-3.5" />
            {removeLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

interface DropColumnProps {
  id: string;
  title: string;
  children: ReactNode;
  empty: string;
  hasItems: boolean;
}

function DropColumn({ id, title, children, empty, hasItems }: DropColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${styles.column} ${isOver ? styles.columnOver : ''}`}>
      <div className={styles.columnTitle}>{title}</div>
      <div className={styles.list}>
        {hasItems ? children : <div className={styles.empty}>{empty}</div>}
      </div>
    </div>
  );
}

export function QueueManagementModal({ agent, open, onClose }: QueueManagementModalProps) {
  const { t } = useTranslation();
  const allQueues = useSelector(selectCcQueues);
  const [supervisorQueueAdd] = useSupervisorQueueAddMutation();
  const [supervisorQueueRemove] = useSupervisorQueueRemoveMutation();
  const [supervisorQueuePenalty] = useSupervisorQueuePenaltyMutation();

  const [penalties, setPenalties] = useState<Record<string, number>>({});
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    if (!open || !agent) return;
    const next: Record<string, number> = {};
    for (const q of agent.queues) {
      next[q] = penalties[q] ?? 0;
    }
    setPenalties(next);
    setRemoveTarget(null);
    // Reset draft penalties when opening / switching agent — intentional omit of penalties deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agent?.interface]);

  const inQueue = useMemo(() => {
    if (!agent) return [];
    const set = new Set(agent.queues);
    return allQueues.filter((q) => set.has(q.name));
  }, [agent, allQueues]);

  const available = useMemo(() => {
    if (!agent) return [];
    const set = new Set(agent.queues);
    return allQueues.filter((q) => !set.has(q.name));
  }, [agent, allQueues]);

  const handleAdd = useCallback(async (queue: string) => {
    if (!agent) return;
    const penalty = penalties[queue] ?? 0;
    await supervisorQueueAdd({
      agentInterface: agent.interface,
      queue,
      penalty,
    });
  }, [agent, penalties, supervisorQueueAdd]);

  const handleRemoveConfirm = useCallback(async () => {
    if (!agent || !removeTarget) return;
    await supervisorQueueRemove({
      agentInterface: agent.interface,
      queue: removeTarget,
    });
    setRemoveTarget(null);
  }, [agent, removeTarget, supervisorQueueRemove]);

  const handlePenaltyCommit = useCallback(async (queue: string, penalty: number) => {
    if (!agent) return;
    const safe = Number.isFinite(penalty) ? Math.max(0, Math.floor(penalty)) : 0;
    setPenalties((prev) => ({ ...prev, [queue]: safe }));
    await supervisorQueuePenalty({
      agentInterface: agent.interface,
      queue,
      penalty: safe,
    });
  }, [agent, supervisorQueuePenalty]);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    setActiveDragId(null);
    if (!agent || !e.over) return;
    const queue = String(e.active.id);
    const fromMode = (e.active.data.current as { mode?: 'in' | 'available' } | undefined)?.mode;
    const overId = String(e.over.id);

    if (fromMode === 'available' && (overId === DROP_IN || inQueue.some((q) => q.name === overId))) {
      await handleAdd(queue);
      return;
    }
    if (fromMode === 'in' && (overId === DROP_AVAILABLE || available.some((q) => q.name === overId))) {
      setRemoveTarget(queue);
    }
  }, [agent, available, handleAdd, inQueue]);

  const activeQueue = useMemo(
    () => allQueues.find((q) => q.name === activeDragId) ?? null,
    [allQueues, activeDragId],
  );

  return (
    <>
      <Dialog open={open && !!agent} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>
              {t('callcenter.supervisor.queueMgmt.title', 'Queue management — {{name}}', {
                name: agent?.name ?? '',
              })}
            </DialogTitle>
          </DialogHeader>

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className={styles.columns}>
              <DropColumn
                id={DROP_IN}
                title={t('callcenter.supervisor.queueMgmt.inQueue', 'In queue')}
                empty={t('callcenter.supervisor.queueMgmt.inQueueEmpty', 'No queues assigned')}
                hasItems={inQueue.length > 0}
              >
                {inQueue.map((q) => (
                  <QueueCard
                    key={q.name}
                    queue={q}
                    mode="in"
                    penalty={penalties[q.name] ?? 0}
                    onPenaltyChange={(v) => setPenalties((prev) => ({ ...prev, [q.name]: v }))}
                    onPenaltyCommit={(v) => handlePenaltyCommit(q.name, v)}
                    onRemove={() => setRemoveTarget(q.name)}
                    addLabel={t('callcenter.supervisor.queueMgmt.add', 'Add')}
                    removeLabel={t('callcenter.supervisor.queueMgmt.remove', 'Remove')}
                    penaltyLabel={t('callcenter.supervisor.queueMgmt.penalty', 'Penalty')}
                  />
                ))}
              </DropColumn>

              <DropColumn
                id={DROP_AVAILABLE}
                title={t('callcenter.supervisor.queueMgmt.available', 'Available')}
                empty={t('callcenter.supervisor.queueMgmt.availableEmpty', 'No available queues')}
                hasItems={available.length > 0}
              >
                {available.map((q) => (
                  <QueueCard
                    key={q.name}
                    queue={q}
                    mode="available"
                    onAdd={() => handleAdd(q.name)}
                    addLabel={t('callcenter.supervisor.queueMgmt.add', 'Add')}
                    removeLabel={t('callcenter.supervisor.queueMgmt.remove', 'Remove')}
                    penaltyLabel={t('callcenter.supervisor.queueMgmt.penalty', 'Penalty')}
                  />
                ))}
              </DropColumn>
            </div>

            <DragOverlay>
              {activeQueue ? (
                <div className={styles.dragGhost}>{queueLabel(activeQueue)}</div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t('callcenter.supervisor.cancel', 'Cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeTarget} onOpenChange={(v) => { if (!v) setRemoveTarget(null); }}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>
              {t('callcenter.supervisor.queueMgmt.confirmRemoveTitle', 'Remove from queue?')}
            </DialogTitle>
          </DialogHeader>
          <Text>
            {t(
              'callcenter.supervisor.queueMgmt.confirmRemoveBody',
              'Remove {{name}} from queue {{queue}}?',
              { name: agent?.name ?? '', queue: removeTarget ?? '' },
            )}
          </Text>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              {t('callcenter.supervisor.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleRemoveConfirm}>
              {t('callcenter.supervisor.queueMgmt.remove', 'Remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
