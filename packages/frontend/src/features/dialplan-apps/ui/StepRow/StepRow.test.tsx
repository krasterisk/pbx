import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DIALPLAN_ACTION_META, type IRouteAction } from '@krasterisk/shared';
import { StepRow } from './StepRow';
import { dialplanAppsRegistry } from '../../model/registry';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

const specDir = dirname(fileURLToPath(import.meta.url));

function action(partial: Partial<IRouteAction> = {}): IRouteAction {
  return {
    id: 'step-1',
    type: 'toqueue',
    params: { target: { source: 'route_pattern' }, options: 'thH' },
    condition: {},
    ...partial,
  };
}

const noop = () => undefined;

describe('StepRow', () => {
  it('renders a toqueue route_pattern summary without key=value leftovers', () => {
    render(
      <StepRow
        action={action()}
        index={0}
        density="comfortable"
        onOpenStep={noop}
        onDuplicate={noop}
        onToggleEnabled={noop}
        onRemove={noop}
        onCopy={noop}
      />,
    );

    const text = screen.getByTestId('step-row-summary').textContent ?? '';
    expect(text).toMatch(/очеред/i);
    expect(text).not.toMatch(/target=/);
  });

  it.each(Object.keys(DIALPLAN_ACTION_META))(
    'registry summarize for %s is defined and non-empty on defaultParams',
    (type) => {
      const config = dialplanAppsRegistry[type as keyof typeof dialplanAppsRegistry];
      expect(config.summarize).toBeTypeOf('function');
      const t = (key: string, fallback?: string | Record<string, unknown>) =>
        typeof fallback === 'string' ? fallback : key;
      const summary = config.summarize!(config.defaultParams ?? {}, t);
      expect(summary.trim().length).toBeGreaterThan(0);
    },
  );

  it('hides handle and action buttons in readOnly', () => {
    render(
      <div data-testid="row-scope">
        <StepRow
          action={action()}
          index={0}
          density="comfortable"
          readOnly
          onOpenStep={noop}
          onDuplicate={noop}
          onToggleEnabled={noop}
          onRemove={noop}
          onCopy={noop}
        />
      </div>,
    );
    const scope = screen.getByTestId('row-scope');
    expect(within(scope).queryAllByRole('button')).toEqual([]);
    expect(screen.queryByLabelText(/перетащ/i)).toBeNull();
    expect(screen.queryByLabelText(/drag/i)).toBeNull();
  });

  it('opens the conditions section when the condition badge is clicked', () => {
    const onOpenStep = vi.fn();
    render(
      <StepRow
        action={action({ condition: { dialstatus: 'BUSY' } })}
        index={0}
        density="comfortable"
        onOpenStep={onOpenStep}
        onDuplicate={noop}
        onToggleEnabled={noop}
        onRemove={noop}
        onCopy={noop}
      />,
    );
    fireEvent.click(screen.getByTestId('step-row-condition-badge'));
    expect(onOpenStep).toHaveBeenCalledWith('step-1', 'conditions');
  });

  it('marks a step after hangup as unreachable without blocking save', () => {
    render(
      <StepRow
        action={action({ id: 'step-2', type: 'toqueue' })}
        index={1}
        density="comfortable"
        unreachable
        onOpenStep={noop}
        onDuplicate={noop}
        onToggleEnabled={noop}
        onRemove={noop}
        onCopy={noop}
      />,
    );
    expect(screen.getByTestId('step-row')).toHaveAttribute('data-unreachable', 'true');
    expect(screen.getByLabelText(/настроить/i)).not.toBeDisabled();
  });

  it('applies density min-height variables', () => {
    const { rerender } = render(
      <StepRow
        action={action()}
        index={0}
        density="compact"
        onOpenStep={noop}
        onDuplicate={noop}
        onToggleEnabled={noop}
        onRemove={noop}
        onCopy={noop}
      />,
    );
    expect(screen.getByTestId('step-row').style.getPropertyValue('--step-min-height')).toBe('44px');

    rerender(
      <StepRow
        action={action()}
        index={0}
        density="comfortable"
        onOpenStep={noop}
        onDuplicate={noop}
        onToggleEnabled={noop}
        onRemove={noop}
        onCopy={noop}
      />,
    );
    expect(screen.getByTestId('step-row').style.getPropertyValue('--step-min-height')).toBe('56px');
  });

  it('gives every icon-only action a title and aria-label', () => {
    render(
      <StepRow
        action={action({ condition: { dialstatus: 'BUSY' } })}
        index={0}
        density="comfortable"
        onOpenStep={noop}
        onDuplicate={noop}
        onToggleEnabled={noop}
        onRemove={noop}
        onCopy={noop}
      />,
    );
    const iconButtons = screen.getAllByRole('button').filter((el) => {
      const text = (el.textContent ?? '').replace(/\s/g, '');
      return text.length === 0 || el.querySelector('svg');
    });
    expect(iconButtons.length).toBeGreaterThan(0);
    iconButtons.forEach((btn) => {
      expect(btn.getAttribute('aria-label') || btn.getAttribute('title')).toBeTruthy();
      expect(btn.getAttribute('aria-label')).toBeTruthy();
      expect(btn.getAttribute('title')).toBeTruthy();
    });
  });

  it('declares aria-label on every icon-only control in source', () => {
    const src = readFileSync(join(specDir, 'StepRow.tsx'), 'utf8');
    const ariaCount = (src.match(/aria-label/g) ?? []).length;
    expect(ariaCount).toBeGreaterThanOrEqual(5);
  });
});
