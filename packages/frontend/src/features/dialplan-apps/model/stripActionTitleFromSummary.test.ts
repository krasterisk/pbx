import { describe, expect, it } from 'vitest';
import { stripActionTitleFromSummary } from './stripActionTitleFromSummary';

describe('stripActionTitleFromSummary', () => {
  it('keeps only the queue name under the Очередь title', () => {
    expect(stripActionTitleFromSummary('Очередь', 'Очередь 700')).toBe('700');
    expect(stripActionTitleFromSummary('Очередь', 'Очередь: не выбрана')).toBe('не выбрана');
    expect(stripActionTitleFromSummary('Очередь', 'Очередь: B-номер маршрута')).toBe('B-номер маршрута');
    expect(stripActionTitleFromSummary('Queue', 'Queue 700')).toBe('700');
  });

  it('strips IVR / group / extension prefixes including #', () => {
    expect(stripActionTitleFromSummary('IVR', 'IVR #Main IVR')).toBe('Main IVR');
    expect(stripActionTitleFromSummary('Группа', 'Группа #12')).toBe('12');
    expect(stripActionTitleFromSummary('Группа вызова', 'Группа #12')).toBe('12');
    expect(stripActionTitleFromSummary('Абонент', 'Абонент 101')).toBe('101');
  });

  it('leaves unrelated summaries intact and drops an exact title match', () => {
    expect(stripActionTitleFromSummary('Завершить вызов', 'Положить трубку')).toBe('Положить трубку');
    expect(stripActionTitleFromSummary('Очередь', 'Очередь')).toBe('');
  });
});
