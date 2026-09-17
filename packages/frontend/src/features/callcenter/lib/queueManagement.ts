import { pointerWithin, type Collision, type CollisionDetection } from '@dnd-kit/core';
import { queueDisplayName } from './displayLabels';

export const DROP_IN = 'drop-in-queue';
export const DROP_AVAILABLE = 'drop-available';

export type QueueDragMode = 'in' | 'available';
export type QueueDragAction = 'add' | 'remove';

export interface QueueLabelSource {
  name: string;
  displayName?: string;
  exten?: string;
}

/** Human queue label for confirmations — never the raw Asterisk id (q700_0). */
export function queueConfirmLabel(queueName: string, catalog: QueueLabelSource[]): string {
  return queueDisplayName(
    queueName,
    catalog.map((q) => ({
      name: q.name,
      displayName: q.displayName || q.name,
      exten: q.exten,
    })),
  );
}

/**
 * Decide add/remove from a drag. `overId` is a drop column or a card in the
 * opposite list. Missing `overId` (typical inside a CSS-transformed Dialog)
 * must be a no-op — the caller should resolve it via pointer/DOM first.
 */
export function resolveQueueDragAction(
  fromMode: QueueDragMode | undefined,
  overId: string | null | undefined,
  inQueueNames: readonly string[],
  availableNames: readonly string[],
): QueueDragAction | null {
  if (!fromMode || !overId) return null;
  if (fromMode === 'available' && (overId === DROP_IN || inQueueNames.includes(overId))) {
    return 'add';
  }
  if (fromMode === 'in' && (overId === DROP_AVAILABLE || availableNames.includes(overId))) {
    return 'remove';
  }
  return null;
}

/** Asterisk QueueAdd reject — member already in the queue (RAM/UI may still be empty). */
export function isAlreadyQueueMemberError(err: unknown): boolean {
  const data = err as { data?: { message?: unknown }; message?: unknown };
  const parts = [data?.data?.message, data?.message];
  const text = parts.filter((p): p is string => typeof p === 'string').join(' ');
  return /already there/i.test(text) || /already a member/i.test(text);
}

/** Walk elementsFromPoint and return the nearest `[data-drop-id]` we know. */
export function dropIdFromElements(
  elements: Array<Element | null | undefined>,
  knownIds: Iterable<string>,
): string | null {
  const known = new Set([...knownIds].map(String));
  for (const el of elements) {
    if (!el || typeof el.closest !== 'function') continue;
    const host = el.closest('[data-drop-id]');
    const id = host?.getAttribute('data-drop-id');
    if (id && known.has(id)) return id;
  }
  return null;
}

function droppableList(containers: unknown): Array<{ id: string | number }> {
  if (Array.isArray(containers)) return containers;
  const maybe = containers as { toArray?: () => Array<{ id: string | number }> };
  return typeof maybe.toArray === 'function' ? maybe.toArray() : [];
}

/**
 * Collision that stays correct inside a Radix Dialog
 * (`fixed; transform: translate(-50%, -50%)` breaks closestCenter rects).
 */
export const dialogSafeCollision: CollisionDetection = (args) => {
  const fromPointer = pointerWithin(args);
  if (fromPointer.length > 0) return fromPointer;

  const { pointerCoordinates, droppableContainers } = args;
  if (!pointerCoordinates || typeof document === 'undefined') return [];

  const known = droppableList(droppableContainers).map((c) => String(c.id));
  const id = dropIdFromElements(
    document.elementsFromPoint(pointerCoordinates.x, pointerCoordinates.y),
    known,
  );
  if (!id) return [];
  return [{ id }] as Collision[];
};
