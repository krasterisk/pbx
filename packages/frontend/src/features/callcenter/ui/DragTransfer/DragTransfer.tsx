import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useState, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneForwarded } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './DragTransfer.module.scss';

/**
 * Wraps the active-call panel + colleagues list with @dnd-kit so the operator
 * can drag the current call onto any READY colleague to initiate a blind
 * transfer. Confirmation modal opens after the drop.
 *
 * Usage:
 *   <DragTransferProvider onTransfer={(target) => agentTransfer({...})}>
 *     <DraggableCall callerIdNum={...} />
 *     {colleagues.map(c => <DroppableColleague agent={c} />)}
 *   </DragTransferProvider>
 */

interface ContextValue {
  draggedCall: { uniqueid: string; callerIdNum: string } | null;
  draggedOverAgent: string | null;
}

interface ProviderProps {
  /** Called when the user confirms the drop. */
  onTransfer: (targetIface: string) => void;
  /** Currently active call (drag source). */
  activeCall: { uniqueid: string; callerIdNum: string } | null;
  children: ReactNode;
}

export function DragTransferProvider({ onTransfer, activeCall, children }: ProviderProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ iface: string; name: string } | null>(null);

  const handleStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over || !activeCall) return;
    const data = e.over.data.current as { iface?: string; name?: string; status?: string } | undefined;
    if (!data?.iface) return;
    if (data.status !== 'READY') return; // can only transfer to available agents
    setConfirmTarget({ iface: data.iface, name: data.name || data.iface });
  }, [activeCall]);

  const confirm = useCallback(() => {
    if (confirmTarget) onTransfer(confirmTarget.iface);
    setConfirmTarget(null);
  }, [confirmTarget, onTransfer]);

  return (
    <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd}>
      {children}

      <DragOverlay>
        {activeId && activeCall ? (
          <div className={styles.dragGhost}>
            <PhoneForwarded className="w-4 h-4" />
            <span>{activeCall.callerIdNum}</span>
          </div>
        ) : null}
      </DragOverlay>

      {confirmTarget && activeCall && (
        <div className={styles.modalOverlay} onClick={() => setConfirmTarget(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              <PhoneForwarded className="w-5 h-5 inline mr-2" />
              {t('callcenter.dnd.confirmTitle', 'Transfer call?')}
            </div>
            <Text>
              {t('callcenter.dnd.confirmBody', 'Blind transfer {{caller}} to {{agent}}?', {
                caller: activeCall.callerIdNum,
                agent: confirmTarget.name,
              })}
            </Text>
            <div className={styles.modalButtons}>
              <Button variant="outline" onClick={() => setConfirmTarget(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button onClick={confirm}>
                {t('callcenter.dnd.confirmAction', 'Transfer')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

// ─── Draggable wrapper for the active-call cell ───────────

interface DraggableCallProps {
  uniqueid: string;
  className?: string;
  children: ReactNode;
}

export function DraggableCall({ uniqueid, className, children }: DraggableCallProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `call-${uniqueid}` });
  return (
    <div
      ref={setNodeRef}
      className={`${className || ''} ${styles.draggable} ${isDragging ? styles.dragging : ''}`}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

// ─── Droppable wrapper for a colleague row ────────────────

interface DroppableColleagueProps {
  agent: IAgent;
  className?: string;
  children: ReactNode;
}

export function DroppableColleague({ agent, className, children }: DroppableColleagueProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `agent-${agent.interface}`,
    data: { iface: agent.interface, name: agent.name, status: agent.status },
  });
  const canAccept = agent.status === 'READY';
  return (
    <div
      ref={setNodeRef}
      className={`${className || ''} ${isOver ? (canAccept ? styles.dropOk : styles.dropBlocked) : ''}`}
    >
      {children}
    </div>
  );
}
