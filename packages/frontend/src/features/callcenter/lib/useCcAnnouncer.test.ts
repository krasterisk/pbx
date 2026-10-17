import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useCcAnnouncer } from './useCcAnnouncer';

describe('useCcAnnouncer (U0.6)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates one polite and one assertive aria-live region and updates them on announce', () => {
    const { result } = renderHook(() => useCcAnnouncer());
    renderHook(() => useCcAnnouncer());

    expect(document.querySelectorAll('[data-testid="cc-live-polite"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="cc-live-assertive"]')).toHaveLength(1);

    act(() => {
      result.current.polite('Осталась 1 минута паузы');
      result.current.assertive('Входящий звонок: Очередь продаж');
    });

    expect(screen.getByTestId('cc-live-polite')).toHaveTextContent('Осталась 1 минута паузы');
    expect(screen.getByTestId('cc-live-assertive')).toHaveTextContent('Входящий звонок: Очередь продаж');
  });
});
