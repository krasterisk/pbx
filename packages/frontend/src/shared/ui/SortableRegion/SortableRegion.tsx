import { createContext, useContext, type ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Button, type ButtonProps } from '../Button';
import cls from './SortableRegion.module.scss';

type Handle = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;
const HandleContext = createContext<Handle | null>(null);

/** Keeps the DnD library and its required DOM styles inside shared UI. */
export function SortableRegion({
  ids,
  onReorder,
  children,
}: {
  ids: string[];
  onReorder: (ids: string[]) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const from = ids.indexOf(String(active.id));
        const to = ids.indexOf(String(over.id));
        if (from >= 0 && to >= 0) onReorder(arrayMove(ids, from, to));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableRegionItem({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <HandleContext.Provider value={{ attributes, listeners }}>
      <div
        ref={setNodeRef}
        className={`${cls.item} ${className ?? ''}`}
        data-dragging={isDragging || undefined}
        style={{ transform: CSS.Transform.toString(transform), transition }}
      >
        {children}
      </div>
    </HandleContext.Provider>
  );
}

export function SortableRegionHandle({ children, ...props }: ButtonProps) {
  const handle = useContext(HandleContext);
  if (!handle) throw new Error('SortableRegionHandle requires SortableRegionItem');
  return (
    <Button type="button" variant="ghost" size="icon" {...props} {...handle.attributes} {...handle.listeners}>
      {children ?? <GripVertical size={16} aria-hidden />}
    </Button>
  );
}
