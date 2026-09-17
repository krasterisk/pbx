import { useCallback, useEffect, useMemo, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
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
} from '@/shared/ui';
import {
  useSupervisorReconcileQueuesMutation,
  useSupervisorQueueAddMutation,
  useSupervisorQueueRemoveMutation,
  useSupervisorQueuePenaltyMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { selectCcQueues, selectCcAgents } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { updateAgent } from '@/features/callcenter/model/slice/callCenterSlice';
import { queueNumberFromName, agentLabelWithExt } from '@/features/callcenter/lib/displayLabels';
import {
  DROP_AVAILABLE,
  DROP_IN,
  dialogSafeCollision,
  isAlreadyQueueMemberError,
  queueConfirmLabel,
  resolveQueueDragAction,
} from '@/features/callcenter/lib/queueManagement';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './QueueManagementModal.module.scss';

function stopCardDrag(e: PointerEvent<HTMLElement>) {
  e.stopPropagation();
}

function mutationErrorMessage(err: unknown, fallback: string): string {
  const data = err as { data?: { message?: unknown }; message?: unknown };
  const message = data?.data?.message ?? data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

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
  return queueConfirmLabel(q.name, catalog);
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
      <div className={styles.cardActions} onPointerDown={stopCardDrag}>
        {mode === 'available' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPointerDown={stopCardDrag}
            onClick={(e) => {
              e.stopPropagation();
              onAdd?.();
            }}
            title={addLabel}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className={styles.actionText}>{addLabel}</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPointerDown={stopCardDrag}
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            title={removeLabel}
          >
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
    <div
      ref={setNodeRef}
      data-drop-id={id}
      className={`${styles.column} ${isOver ? styles.columnOver : ''}`}
    >
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
    const live = liveAgents.find((a) => a.interface === agentProp.interface)
      || (agentProp.userId > 0
        ? liveAgents.find((a) => a.userId === agentProp.userId && !/^user:/i.test(a.interface))
        : undefined);
    return live ?? agentProp;
  }, [agentProp, liveAgents]);
  // Catalog from DB — same source as ShiftLoginModal (not only live AMI snapshot).
  const { data: dbQueues = [] } = useGetQueuesQuery(undefined, { skip: !open });
  const [reconcileQueues] = useSupervisorReconcileQueuesMutation();
  const [supervisorQueueAdd] = useSupervisorQueueAddMutation();
  const [supervisorQueueRemove] = useSupervisorQueueRemoveMutation();
  const [supervisorQueuePenalty] = useSupervisorQueuePenaltyMutation();

  const [membershipReady, setMembershipReady] = useState(false);
  const [penalties, setPenalties] = useState<Record<string, number>>({});
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agent?.interface]);

  useEffect(() => {
    if (!open || !agentProp) {
      setMembershipReady(false);
      return;
    }
    let cancelled = false;
    setMembershipReady(false);
    void (async () => {
      try {
        const res = await reconcileQueues({ agentInterface: agentProp.interface }).unwrap();
        if (cancelled) return;
        if (res.queues) {
          dispatch(updateAgent({
            interface: res.interface || agentProp.interface,
            queues: res.queues,
            queuesDetached: false,
          }));
        }
      } catch {
        /* keep last known lists */
      } finally {
        if (!cancelled) setMembershipReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, agentProp, dispatch, reconcileQueues]);

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
    const previous = agent.queues ?? [];
    if (previous.includes(queue)) return;
    const queues = [...previous, queue];
    dispatch(updateAgent({
      interface: agent.interface,
      queues,
      queuesDetached: false,
    }));
    try {
      const res = await supervisorQueueAdd({
        agentInterface: agent.interface,
        queue,
        penalty: penalties[queue] ?? 0,
      }).unwrap();
      if (res.queues) {
        dispatch(updateAgent({
          interface: agent.interface,
          queues: res.queues,
          queuesDetached: false,
        }));
      }
    } catch (err: unknown) {
      if (isAlreadyQueueMemberError(err)) return;
      dispatch(updateAgent({ interface: agent.interface, queues: previous }));
      toast.error(mutationErrorMessage(
        err,
        t('callcenter.supervisor.queueMgmt.addFailed', 'Failed to add to queue'),
      ));
    }
  }, [agent, dispatch, penalties, supervisorQueueAdd, t]);

  const handleRemove = useCallback(async (queue: string) => {
    if (!agent) return;
    const previous = agent.queues ?? [];
    if (!previous.includes(queue)) return;
    dispatch(updateAgent({
      interface: agent.interface,
      queues: previous.filter((q) => q !== queue),
    }));
    try {
      const res = await supervisorQueueRemove({
        agentInterface: agent.interface,
        queue,
      }).unwrap();
      if (res.queues) {
        dispatch(updateAgent({
          interface: agent.interface,
          queues: res.queues,
        }));
      }
    } catch (err: unknown) {
      dispatch(updateAgent({ interface: agent.interface, queues: previous }));
      toast.error(mutationErrorMessage(
        err,
        t('callcenter.supervisor.queueMgmt.removeFailed', 'Failed to remove from queue'),
      ));
    }
  }, [agent, dispatch, supervisorQueueRemove, t]);

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
    if (!agent) return;
    const queue = String(e.active.id);
    const fromMode = (e.active.data.current as { mode?: 'in' | 'available' } | undefined)?.mode;
    const action = resolveQueueDragAction(
      fromMode,
      e.over ? String(e.over.id) : null,
      inQueue.map((q) => q.name),
      available.map((q) => q.name),
    );
    if (action === 'add') {
      await handleAdd(queue);
      return;
    }
    if (action === 'remove') {
      await handleRemove(queue);
    }
  }, [agent, available, clearDrag, handleAdd, handleRemove, inQueue]);

  const activeQueue = useMemo(
    () => catalog.find((q) => q.name === activeDragId) ?? null,
    [catalog, activeDragId],
  );

  return (
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
            {!membershipReady ? (
              <div className={styles.empty}>
                {t('callcenter.supervisor.queueMgmt.loading', 'Loading queue membership…')}
              </div>
            ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={dialogSafeCollision}
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
                      onRemove={() => handleRemove(q.name)}
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
            )}
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
              {t('callcenter.supervisor.queueMgmt.close', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
