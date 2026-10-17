import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { DEFAULT_AGENT_HOTKEYS } from '@krasterisk/shared';
import { useAgentHotkeys, type AgentHotkeyHandlers } from './useAgentHotkeys';

function Host({
  handlers,
  map,
  enabled = true,
}: {
  handlers: AgentHotkeyHandlers;
  map?: Record<string, string>;
  enabled?: boolean;
}) {
  useAgentHotkeys(map as never, handlers, enabled);
  return <textarea data-testid="note" />;
}

describe('useAgentHotkeys (U2.4)', () => {
  it('fires the handler of every default combo (by code, so the Russian layout works)', () => {
    const handlers = {
      answer: vi.fn(),
      hangup: vi.fn(),
      mute: vi.fn(),
      hold: vi.fn(),
      transfer: vi.fn(),
      pauseToggle: vi.fn(),
      finishWrapup: vi.fn(),
    };
    render(<Host handlers={handlers} />);
    const press = (code: string, key: string) =>
      fireEvent.keyDown(window, { code, key, altKey: true });
    press('KeyA', 'ф');
    press('KeyH', 'р');
    press('KeyM', 'ь');
    press('KeyU', 'г');
    press('KeyT', 'е');
    press('KeyP', 'з');
    press('KeyW', 'ц');
    for (const fn of Object.values(handlers)) expect(fn).toHaveBeenCalledTimes(1);
  });

  it('opens help with "?" but not while typing in a field; Alt combos still work in a field', () => {
    const help = vi.fn();
    const answer = vi.fn();
    const { getByTestId } = render(<Host handlers={{ help, answer }} />);
    const note = getByTestId('note');
    fireEvent.keyDown(note, { code: 'Slash', key: '?', shiftKey: true });
    expect(help).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { code: 'Slash', key: '?', shiftKey: true });
    expect(help).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(note, { code: 'KeyA', key: 'a', altKey: true });
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an action without a handler and does not swallow the key', () => {
    render(<Host handlers={{}} />);
    const notPrevented = fireEvent.keyDown(window, { code: 'KeyA', key: 'a', altKey: true });
    expect(notPrevented).toBe(true);
  });

  it('ignores AltGr (Ctrl+Alt) and key repeat', () => {
    const answer = vi.fn();
    render(<Host handlers={{ answer }} />);
    fireEvent.keyDown(window, { code: 'KeyA', key: 'a', altKey: true, ctrlKey: true });
    fireEvent.keyDown(window, { code: 'KeyA', key: 'a', altKey: true, repeat: true });
    expect(answer).not.toHaveBeenCalled();
  });

  it('a custom map overrides the defaults; disabled hook fires nothing', () => {
    const answer = vi.fn();
    const { rerender } = render(
      <Host handlers={{ answer }} map={{ ...DEFAULT_AGENT_HOTKEYS, answer: 'Alt+KeyY' }} />,
    );
    fireEvent.keyDown(window, { code: 'KeyA', key: 'a', altKey: true });
    expect(answer).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { code: 'KeyY', key: 'y', altKey: true });
    expect(answer).toHaveBeenCalledTimes(1);

    rerender(<Host handlers={{ answer }} map={{ ...DEFAULT_AGENT_HOTKEYS, answer: 'Alt+KeyY' }} enabled={false} />);
    fireEvent.keyDown(window, { code: 'KeyY', key: 'y', altKey: true });
    expect(answer).toHaveBeenCalledTimes(1);
  });
});
