import type { IRouteAction } from '@krasterisk/shared';

let buffer: IRouteAction | null = null;

export function copyStep(action: IRouteAction): void {
  buffer = structuredClone(action);
}

export function peekStep(): IRouteAction | null {
  return buffer;
}

export function hasStep(): boolean {
  return buffer !== null;
}

export function pasteStep(makeId: () => string): IRouteAction | null {
  if (!buffer) return null;
  const clone = structuredClone(buffer);
  return { ...clone, id: makeId() };
}

export function resetClipboard(): void {
  buffer = null;
}
