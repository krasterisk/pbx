import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  createContext, useState, useCallback, useContext, ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneForwarded } from 'lucide-react';
import {
  Button, Text,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './DragTransfer.module.scss';

/**
 * DnD transfer: drag active call onto a READY colleague or click colleague
 * to open the same 3-action confirmation modal (blind / attended / cancel).
 */

interface DragTransferContextValue {
  requestTransfer: (agent: IAgent) => void;
}

const DragTransferContext = createContext<DragTransferContextValue | null>(null);

export function useDragTransfer(): DragTransferContextValue {
  const ctx = useContext(DragTransferContext);
  if (!ctx) {
    throw new Error('useDragTransfer must be used within DragTransferProvider');
  }
  return ctx;
}

interface ProviderProps {
  onTransfer: (targetIface: string, type: 'blind' | 'attended') => void;
  activeCall: { uniqueid: string; callerIdNum: string } | null;
  children: ReactNode;
}

export function DragTransferProvider({ onTransfer, activeCall, children }: ProviderProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    iface: string;
    name: string;
    ext: string;
  } | null>(null);

  const openConfirm = useCallback((agent: IAgent) => {
    if (!activeCall || agent.status !== 'READY') return;
    const ext = agent.interface.split('/').pop() || agent.interface;
    setConfirmTarget({ iface: agent.interface, name: agent.name, ext });
  }, [activeCall]);

  const handleStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over || !activeCall) return;
    const data = e.over.data.current as { iface?: string; name?: string; status?: string } | undefined;
    if (!data?.iface || data.status !== 'READY') return;
    const ext = data.iface.split('/').pop() || data.iface;
    setConfirmTarget({ iface: data.iface, name: data.name || data.iface, ext });
  }, [activeCall]);

  const closeConfirm = useCallback(() => setConfirmTarget(null), []);

  const confirmBlind = useCallback(() => {
    if (confirmTarget) onTransfer(confirmTarget.iface, 'blind');
    setConfirmTarget(null);
  }, [confirmTarget, onTransfer]);

  const confirmAttended = useCallback(() => {
    if (confirmTarget) onTransfer(confirmTarget.iface, 'attended');
    setConfirmTarget(null);
  }, [confirmTarget, onTransfer]);

  return (
    <DragTransferContext.Provider value={{ requestTransfer: openConfirm }}>
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

        <Dialog open={!!confirmTarget && !!activeCall} onOpenChange={(open) => !open && closeConfirm()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {confirmTarget
                  ? t('callcenter.dnd.title', 'Transfer call to {{name}} ({{ext}})?', {
                      name: confirmTarget.name,
                      ext: confirmTarget.ext,
                    })
                  : t('callcenter.dnd.confirmTitle', 'Transfer call?')}
              </DialogTitle>
            </DialogHeader>
            {activeCall && confirmTarget && (
              <Text variant="muted" className="text-sm">
                {activeCall.callerIdNum}
              </Text>
            )}
            <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
              <Button onClick={confirmBlind} className="w-full">
                {t('callcenter.dnd.blind', 'Blind transfer')}
              </Button>
              <Button variant="outline" onClick={confirmAttended} className="w-full">
                {t('callcenter.dnd.attended', 'Attended transfer')}
              </Button>
              <Button variant="ghost" onClick={closeConfirm} className="w-full">
                {t('callcenter.dnd.cancel', 'Cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DndContext>
    </DragTransferContext.Provider>
  );
}

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

interface DroppableColleagueProps {
  agent: IAgent;
  className?: string;
  children: ReactNode;
  onColleagueClick?: (agent: IAgent) => void;
}

export function DroppableColleague({ agent, className, children, onColleagueClick }: DroppableColleagueProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `agent-${agent.interface}`,
    data: { iface: agent.interface, name: agent.name, status: agent.status },
  });
  const canAccept = agent.status === 'READY';
  return (
    <div
      ref={setNodeRef}
      className={`${className || ''} ${isOver ? (canAccept ? styles.dropOk : styles.dropBlocked) : ''}`}
      onClick={() => onColleagueClick?.(agent)}
      role={onColleagueClick ? 'button' : undefined}
      tabIndex={onColleagueClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onColleagueClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onColleagueClick(agent);
        }
      }}
    >
      {children}
    </div>
  );
}
