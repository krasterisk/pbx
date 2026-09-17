import { describe, expect, it } from 'vitest';
import {
  DROP_AVAILABLE,
  DROP_IN,
  dropIdFromElements,
  isAlreadyQueueMemberError,
  queueConfirmLabel,
  resolveQueueDragAction,
} from './queueManagement';

describe('queueConfirmLabel', () => {
  it('uses display name + number instead of raw Asterisk id', () => {
    expect(
      queueConfirmLabel('q700_0', [{ name: 'q700_0', displayName: 'Очередь продаж', exten: '700' }]),
    ).toBe('Очередь продаж (700)');
  });

  it('falls back to the normalized number when catalog has no display name', () => {
    expect(queueConfirmLabel('q700_0', [])).toBe('700');
    expect(queueConfirmLabel('q700_0', [{ name: 'q700_0', displayName: 'q700_0' }])).toBe('700');
  });
});

describe('resolveQueueDragAction', () => {
  it('adds when dropping an available card onto the in-queue column or an in-queue card', () => {
    expect(resolveQueueDragAction('available', DROP_IN, ['q700_0'], ['q701_0'])).toBe('add');
    expect(resolveQueueDragAction('available', 'q700_0', ['q700_0'], ['q701_0'])).toBe('add');
  });

  it('removes when dropping an in-queue card onto available', () => {
    expect(resolveQueueDragAction('in', DROP_AVAILABLE, ['q700_0'], ['q701_0'])).toBe('remove');
    expect(resolveQueueDragAction('in', 'q701_0', ['q700_0'], ['q701_0'])).toBe('remove');
  });

  it('is a no-op when collision missed the drop target (Dialog transform)', () => {
    expect(resolveQueueDragAction('available', null, ['q700_0'], ['q701_0'])).toBeNull();
    expect(resolveQueueDragAction('available', undefined, [], ['q701_0'])).toBeNull();
  });

  it('ignores a drop back onto the same column', () => {
    expect(resolveQueueDragAction('available', DROP_AVAILABLE, [], ['q701_0'])).toBeNull();
    expect(resolveQueueDragAction('in', DROP_IN, ['q700_0'], [])).toBeNull();
  });
});

describe('isAlreadyQueueMemberError', () => {
  it('detects the live 400 body from Asterisk QueueAdd', () => {
    expect(isAlreadyQueueMemberError({
      data: { message: 'Failed to add to queue: Unable to add interface: Already there' },
      status: 400,
    })).toBe(true);
  });

  it('ignores unrelated failures', () => {
    expect(isAlreadyQueueMemberError({ data: { message: 'No such queue' } })).toBe(false);
  });
});

describe('dropIdFromElements', () => {
  it('returns the nearest data-drop-id that is a known droppable', () => {
    const column = document.createElement('div');
    column.setAttribute('data-drop-id', DROP_IN);
    const card = document.createElement('div');
    column.appendChild(card);

    expect(dropIdFromElements([card], [DROP_IN, DROP_AVAILABLE])).toBe(DROP_IN);
  });

  it('skips unknown drop ids', () => {
    const el = document.createElement('div');
    el.setAttribute('data-drop-id', 'ghost');
    expect(dropIdFromElements([el], [DROP_IN])).toBeNull();
  });
});
