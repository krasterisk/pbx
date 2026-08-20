import { createContext, useContext, type ReactNode } from 'react';
import { createElement } from 'react';

const ChainLabelsContext = createContext<string[]>([]);

export function collectChainLabelNames(
  actions: Array<{ type?: string; params?: { label_name?: unknown } }>,
): string[] {
  const names: string[] = [];
  for (const action of actions) {
    if (action.type !== 'label') continue;
    const name = typeof action.params?.label_name === 'string' ? action.params.label_name.trim() : '';
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export function ChainLabelsProvider({
  labels,
  children,
}: {
  labels: string[];
  children: ReactNode;
}) {
  return createElement(ChainLabelsContext.Provider, { value: labels }, children);
}

export function useChainLabels(): string[] {
  return useContext(ChainLabelsContext);
}
