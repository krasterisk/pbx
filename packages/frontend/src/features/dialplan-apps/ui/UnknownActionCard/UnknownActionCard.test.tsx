import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DIALPLAN_ACTION_META } from '@krasterisk/shared';
import { UnknownActionCard } from './UnknownActionCard';
import { ACTION_TYPES_LIST, dialplanAppsRegistry } from '../../model/registry';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

describe('UnknownActionCard', () => {
  it('renders the raw type and both delete / replace actions', () => {
    const onDelete = vi.fn();
    const onReplaceType = vi.fn();
    render(
      <UnknownActionCard
        type="legacy_widget"
        params={{ foo: 'bar', n: 2 }}
        onDelete={onDelete}
        onReplaceType={onReplaceType}
      />,
    );

    expect(screen.getByText('legacy_widget')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /удалить/i }));
    expect(onDelete).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /заменить тип/i })).toBeInTheDocument();
  });

  it('keeps registry, ACTION_TYPES_LIST and DIALPLAN_ACTION_META keys in sync', () => {
    const metaKeys = Object.keys(DIALPLAN_ACTION_META).sort();
    const registryKeys = Object.keys(dialplanAppsRegistry).sort();
    const listKeys = ACTION_TYPES_LIST.map((item) => item.type).sort();
    expect(registryKeys).toEqual(metaKeys);
    expect(listKeys).toEqual(metaKeys);
    expect(metaKeys).toHaveLength(28);
  });

  it('requires schema, summarize, terminal, allowedIn and optionFlags on every registry entry', () => {
    Object.values(dialplanAppsRegistry).forEach((config) => {
      expect(Array.isArray(config.schema)).toBe(true);
      expect(config.summarize).toBeTypeOf('function');
      expect(['always', 'conditional', 'never']).toContain(config.terminal);
      expect(config.allowedIn?.length).toBeGreaterThan(0);
      expect(Array.isArray(config.optionFlags)).toBe(true);
    });
  });
});
