import type { HTMLAttributes, KeyboardEvent, MouseEvent } from "react";

const interactiveSelector =
  'button, input, select, textarea, a, label, summary, audio, video, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="checkbox"], [role="switch"], [role="combobox"], [role="slider"], [data-table-actions], [data-table-no-activate]';

/** Ignore controls inside a row/card, including checkbox labels and action-group gaps. */
export function isTableControl(event: MouseEvent<HTMLElement>): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return true;
  const control = target.closest(interactiveSelector);
  return (
    !!control &&
    control !== event.currentTarget &&
    event.currentTarget.contains(control)
  );
}

export function tableActivation<TElement extends HTMLElement>(
  activate?: () => void,
  handlers: Pick<HTMLAttributes<TElement>, "onClick" | "onKeyDown"> = {},
): Pick<HTMLAttributes<TElement>, "onClick" | "onKeyDown" | "tabIndex"> {
  if (!activate) return handlers;
  return {
    tabIndex: 0,
    onClick: (event: MouseEvent<TElement>) => {
      handlers.onClick?.(event);
      if (!event.defaultPrevented && !isTableControl(event)) activate();
    },
    onKeyDown: (event: KeyboardEvent<TElement>) => {
      handlers.onKeyDown?.(event);
      if (
        !event.defaultPrevented &&
        event.target === event.currentTarget &&
        ["Enter", " "].includes(event.key)
      ) {
        event.preventDefault();
        activate();
      }
    },
  };
}
