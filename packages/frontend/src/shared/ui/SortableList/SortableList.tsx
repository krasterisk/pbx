import type { ReactNode } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { Button } from '../Button';
import cls from './SortableList.module.scss';

export interface SortableListItem { id: string; content: ReactNode; label: string }
interface Props {
  items: SortableListItem[];
  onReorder: (ids: string[]) => void;
  moveUpLabel: string;
  moveDownLabel: string;
  dragLabel: string;
}
const Item = ({ item, index, count, move, labels }: {
  item: SortableListItem; index: number; count: number;
  move: (from: number, to: number) => void; labels: Pick<Props, 'moveUpLabel' | 'moveDownLabel' | 'dragLabel'>;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cls.item}>
      <Button type="button" variant="ghost" size="icon" {...attributes} {...listeners} className={cls.handle}
        aria-label={`${labels.dragLabel}: ${item.label}`}><GripVertical aria-hidden /></Button>
      <div className={cls.content}>{item.content}</div>
      <Button type="button" variant="ghost" size="icon" aria-label={`${labels.moveUpLabel}: ${item.label}`}
        disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUp aria-hidden /></Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`${labels.moveDownLabel}: ${item.label}`}
        disabled={index === count - 1} onClick={() => move(index, index + 1)}><ArrowDown aria-hidden /></Button>
    </div>
  );
};

export const SortableList = ({ items, onReorder, ...labels }: Props) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = items.map((item) => item.id);
  const move = (from: number, to: number) => { if (from >= 0 && to >= 0 && to < ids.length) onReorder(arrayMove(ids, from, to)); };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
      if (over && active.id !== over.id) move(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={cls.list}>{items.map((item, index) => <Item key={item.id} item={item} index={index} count={items.length} move={move} labels={labels} />)}</div>
      </SortableContext>
    </DndContext>
  );
};
