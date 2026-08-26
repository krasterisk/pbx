import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { getEventCoordinates } from '@dnd-kit/utilities';
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
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { selectCcQueues, selectCcAgents } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { updateAgent } from '@/features/callcenter/model/slice/callCenterSlice';
import { queueDisplayName, queueNumberFromName, agentLabelWithExt } from '@/features/callcenter/lib/displayLabels';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './QueueManagementModal.module.scss';

const DROP_IN = 'drop-in-queue';
const DROP_AVAILABLE = 'drop-available';

export interface QueueManagementModalProps {
  agent: IAgent | null;
  open: boolean;
  onClose: () => void;
  /**
   * When set, only these queue tokens appear (access-list scope: "700", "q700_0", …).
   * null/undefined = all configured queues.
   */
  allowedQueues?: string[] | null;
}

/** Minimal row for drag lists — DB catalog + optional live overlay. */
interface QueueRow {
  name: string;
  displayName: string;
  exten?: string;
}

function isQueueAllowed(queueName: string, exten: string | undefined, allowed: Set<string> | null): boolean {
  if (!allowed) return true;
  const name = (queueName || '').toLowerCase();
  const ext = (exten || '').toLowerCase();
  if (allowed.has(name) || (ext && allowed.has(ext))) return true;
  const num = queueNumberFromName(queueName)?.toLowerCase();
  return Boolean(num && allowed.has(num));
}

function queueLabel(q: QueueRow, catalog: QueueRow[]): string {
  return queueDisplayName(q.name, catalog.map((x) => ({
    name: x.name,
    displayName: x.displayName,
    exten: x.exten,
  })));
}

interface QueueCardProps {
  queue: QueueRow;
  catalog: QueueRow[];
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
  catalog,
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
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label="Drag"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="w-3.5 h-3.5 opacity-40" />
      </button>
      <span className={styles.cardName}>{queueLabel(queue, catalog)}</span>
      {mode === 'in' && (
        <div className={styles.penaltyWrap}>
          <span className={styles.penaltyLabel}>{penaltyLabel}</span>
          <input
            type="number"
            className={styles.penaltyInput}
            value={penalty ?? 0}
            min={0}
            onChange={(e) => onPenaltyChange?.(Number(e.target.value))}
            onBlur={(e) => onPenaltyCommit?.(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            aria-label={penaltyLabel}
          />
        </div>
      )}
      <div className={styles.cardActions}>
        {mode === 'available' ? (
          <Button type="button" variant="outline" size="sm" onClick={onAdd} title={addLabel}>
            <Plus className="w-3.5 h-3.5" />
            <span className={styles.actionText}>{addLabel}</span>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onRemove} title={removeLabel}>
            <Minus className="w-3.5 h-3.5" />
            <span className={styles.actionText}>{removeLabel}</span>
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

/**
 * Fixed ghost under the cursor. Avoids @dnd-kit DragOverlay mis-alignment
 * inside Radix Dialog (content uses translate(-50%, -50%)).
 */
function CursorDragGhost({
  label,
  grabOffset,
  initialPos,
}: {
  label: string;
  grabOffset: { x: number; y: number };
  initialPos: { x: number; y: number };
}) {
  const [pos, setPos] = useState(initialPos);

  useEffect(() => {
    setPos(initialPos);
  }, [initialPos.x, initialPos.y]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.dragGhost}
      style={{
        position: 'fixed',
        left: pos.x - grabOffset.x,
        top: pos.y - grabOffset.y,
        zIndex: 100000,
        margin: 0,
        pointerEvents: 'none',
      }}
    >
      {label}
    </div>,
    document.body,
  );
}

export function QueueManagementModal({
  agent: agentProp,
  open,
  onClose,
  allowedQueues = null,
}: QueueManagementModalProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const liveQueues = useSelector(selectCcQueues);
  const liveAgents = useSelector(selectCcAgents);
  // Prefer live SSE agent so queue add/remove refreshes the columns immediately.
  // Parent often holds a stale snapshot from open time.
  const agent = useMemo(() => {
    if (!agentProp) return null;
    const live = liveAgents.find((a) => a.interface === agentProp.interface);
    return live ?? agentProp;
  }, [agentProp, liveAgents]);
  // Catalog from DB — same source as ShiftLoginModal (not only live AMI snapshot).
  const { data: dbQueues = [] } = useGetQueuesQuery(undefined, { skip: !open });
  const [supervisorQueueAdd] = useSupervisorQueueAddMutation();
  const [supervisorQueueRemove] = useSupervisorQueueRemoveMutation();
  const [supervisorQueuePenalty] = useSupervisorQueuePenaltyMutation();

  const [penalties, setPenalties] = useState<Record<string, number>>({});
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [grabOffset, setGrabOffset] = useState({ x: 0, y: 0 });
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const allowedSet = useMemo(() => {
    if (allowedQueues == null) return null;
    if (allowedQueues.length === 0) return null; // unrestricted empty list
    return new Set(allowedQueues.map((q) => q.toLowerCase()));
  }, [allowedQueues]);

  const catalog = useMemo((): QueueRow[] => {
    const byName = new Map<string, QueueRow>();

    for (const q of dbQueues) {
      const name = String(q.name || '');
      if (!name) continue;
      if (!isQueueAllowed(name, q.exten, allowedSet)) continue;
      byName.set(name, {
        name,
        displayName: q.display_name || name,
        exten: q.exten,
      });
    }

    // Live rows may include queues not yet in a stale RTK cache, still access-allowed.
    for (const q of liveQueues) {
      if (!isQueueAllowed(q.name, queueNumberFromName(q.name) ?? undefined, allowedSet)) continue;
      const prev = byName.get(q.name);
      byName.set(q.name, {
        name: q.name,
        displayName: prev?.displayName || q.displayName || q.name,
        exten: prev?.exten || queueNumberFromName(q.name) || undefined,
      });
    }

    // Agent already in a queue that somehow missed both lists — still show it.
    if (agent) {
      for (const name of agent.queues) {
        if (byName.has(name)) continue;
        if (!isQueueAllowed(name, queueNumberFromName(name) ?? undefined, allowedSet)) continue;
        byName.set(name, {
          name,
          displayName: name,
          exten: queueNumberFromName(name) || undefined,
        });
      }
    }

    return [...byName.values()].sort((a, b) =>
      queueLabel(a, [...byName.values()]).localeCompare(queueLabel(b, [...byName.values()])),
    );
  }, [dbQueues, liveQueues, allowedSet, agent]);

  useEffect(() => {
    if (!open || !agent) return;
    const next: Record<string, number> = {};
    for (const q of agent.queues) {
      next[q] = penalties[q] ?? 0;
    }
    setPenalties(next);
    setRemoveTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agent?.interface]);

  const inQueue = useMemo(() => {
    if (!agent) return [];
    const set = new Set(agent.queues);
    return catalog.filter((q) => set.has(q.name));
  }, [agent, catalog]);

  const available = useMemo(() => {
    if (!agent) return [];
    const set = new Set(agent.queues);
    return catalog.filter((q) => !set.has(q.name));
  }, [agent, catalog]);

  const handleAdd = useCallback(async (queue: string) => {
    if (!agent) return;
    const penalty = penalties[queue] ?? 0;
    await supervisorQueueAdd({
      agentInterface: agent.interface,
      queue,
      penalty,
    }).unwrap();
    // Optimistic / SSE may be on another tenant than the supervisor JWT.
    const queues = agent.queues.includes(queue) ? agent.queues : [...agent.queues, queue];
    dispatch(updateAgent({
      interface: agent.interface,
      queues,
      queuesDetached: false,
    }));
  }, [agent, dispatch, penalties, supervisorQueueAdd]);

  const handleRemoveConfirm = useCallback(async () => {
    if (!agent || !removeTarget) return;
    const queue = removeTarget;
    await supervisorQueueRemove({
      agentInterface: agent.interface,
      queue,
    }).unwrap();
    dispatch(updateAgent({
      interface: agent.interface,
      queues: agent.queues.filter((q) => q !== queue),
    }));
    setRemoveTarget(null);
  }, [agent, dispatch, removeTarget, supervisorQueueRemove]);

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
    const coords = getEventCoordinates(e.activatorEvent);
    const rect = e.active.rect.current.initial;
    if (coords) {
      setPointerPos({ x: coords.x, y: coords.y });
      if (rect) {
        setGrabOffset({
          x: coords.x - rect.left,
          y: coords.y - rect.top,
        });
      } else {
        setGrabOffset({ x: 24, y: 16 });
      }
    } else {
      setGrabOffset({ x: 24, y: 16 });
    }
  }, []);

  const clearDrag = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    clearDrag();
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
  }, [agent, available, clearDrag, handleAdd, inQueue]);

  const activeQueue = useMemo(
    () => catalog.find((q) => q.name === activeDragId) ?? null,
    [catalog, activeDragId],
  );

  return (
    <>
      <Dialog open={open && !!agent} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent size="large" className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>
              {t('callcenter.supervisor.queueMgmt.title', 'Queue management: {{name}}', {
                name: agent ? agentLabelWithExt(agent) : '',
              })}
            </DialogTitle>
          </DialogHeader>

          <div className={styles.body}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={clearDrag}
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
                      catalog={catalog}
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
                      catalog={catalog}
                      mode="available"
                      onAdd={() => handleAdd(q.name)}
                      addLabel={t('callcenter.supervisor.queueMgmt.add', 'Add')}
                      removeLabel={t('callcenter.supervisor.queueMgmt.remove', 'Remove')}
                      penaltyLabel={t('callcenter.supervisor.queueMgmt.penalty', 'Penalty')}
                    />
                  ))}
                </DropColumn>
              </div>
            </DndContext>
          </div>

          {activeQueue ? (
            <CursorDragGhost
              label={queueLabel(activeQueue, catalog)}
              grabOffset={grabOffset}
              initialPos={pointerPos}
            />
          ) : null}

          <DialogFooter className={styles.dialogFooter}>
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
              { name: agent ? agentLabelWithExt(agent) : '', queue: removeTarget ?? '' },
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
