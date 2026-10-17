import { useEffect, useRef } from 'react';
import {
  DEFAULT_AGENT_HOTKEYS,
  findHotkeyAction,
  parseHotkey,
  type AgentHotkeyAction,
  type AgentHotkeyMap,
} from '@krasterisk/shared';

export type AgentHotkeyHandlers = Partial<Record<AgentHotkeyAction, (() => void) | undefined>>;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Agent workspace hotkeys (U2.4). `map` comes from tenant settings (`agent_hotkeys_effective`), the
 * built-in set when absent. Matching is by `KeyboardEvent.code`, so the Russian layout works.
 *
 * - A combo without `Alt` (the "?" help combo) is ignored while typing in a field; Alt combos still fire.
 * - An action without a handler (e.g. "answer" when nothing rings) does nothing and the key is not swallowed.
 * - `enabled = false` (a modal is open, softphone absent) disables all of them.
 */
export function useAgentHotkeys(
  map: Readonly<AgentHotkeyMap> | undefined,
  handlers: AgentHotkeyHandlers,
  enabled = true,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const effective = map ?? DEFAULT_AGENT_HOTKEYS;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const action = findHotkeyAction(e, effective);
      if (!action) return;
      const handler = handlersRef.current[action];
      if (!handler) return;
      const parsed = parseHotkey(effective[action]);
      if (isTypingTarget(e.target) && !parsed?.alt) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [effective, enabled]);
}
