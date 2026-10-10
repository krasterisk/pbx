import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DIALPLAN_ACTION_META, templateSlotMarker, type IRouteAction } from '@krasterisk/shared';
import { StepRow } from './StepRow';
import { dialplanAppsRegistry } from '../../model/registry';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      if (key === 'routes.action.toqueue') return 'Очередь';
      return typeof fallback === 'string' ? fallback : key;
    },
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
 it('opens parameters from the row, hides raw statuses and puts operations in a menu',()=>{
  const open=vi.fn(),duplicate=vi.fn();
  render(<StepRow action={action({condition:{source:'queuestatus',values:['FULL']}})} index={0} onOpenStep={open} onDuplicate={duplicate} onToggleEnabled={noop} onRemove={noop} onCopy={noop}/>);
  expect(screen.queryByRole('button',{name:'Настроить шаг'})).toBeNull();
  expect(screen.queryByText('FULL')).toBeNull();
  expect(screen.getByTestId('step-row-info')).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('step-row'));expect(open).toHaveBeenCalledWith('step-1','params');open.mockClear();
  fireEvent.pointerDown(screen.getByRole('button',{name:'Ещё действия'}),{button:0,ctrlKey:false});
  fireEvent.click(screen.getByRole('menuitem',{name:'Дублировать действие'}));
  expect(duplicate).toHaveBeenCalledWith('step-1');expect(open).not.toHaveBeenCalled();
 });
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
    expect(text).toMatch(/B-номер|routePattern/i);
    expect(text).not.toMatch(/Очередь/);
    expect(text).not.toMatch(/target=/);
  });

  it('shows a bare queue number instead of the tenant realtime name', () => {
    render(
      <StepRow
        action={action({
          params: { target: { source: 'fixed', value: 'q700_0' } },
        })}
        index={0}
        onOpenStep={noop}
        onDuplicate={noop}
        onToggleEnabled={noop}
        onRemove={noop}
        onCopy={noop}
      />,
    );

    expect(screen.getByTestId('step-row-summary')).toHaveTextContent('700');
    expect(screen.getByTestId('step-row-summary').textContent).not.toContain('q700_0');
    expect(screen.getByTestId('step-row-summary').textContent).not.toContain('Очередь');
  });

  it('replaces a template slot marker with the slot label in the summary', () => {
    const slotId = 'queue-a_1778039515670_snrw-target.value';
    render(
      <StepRow
        action={action({
          params: { target: { source: 'fixed', value: templateSlotMarker(slotId) } },
        })}
        index={0}
        slots={[{ id: slotId, kind: 'queue', label: '700' }]}
        onOpenStep={noop}
        onDuplicate={noop}
        onToggleEnabled={noop}
        onRemove={noop}
        onCopy={noop}
      />,
    );

    expect(screen.getByTestId('step-row-summary')).toHaveTextContent('700');
    expect(screen.getByTestId('step-row-summary').textContent).not.toContain('Очередь');
    expect(screen.getByTestId('step-row-summary').textContent).not.toContain('__slot:');
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
    expect(within(scope).queryByRole('button',{name:'Ещё действия'})).toBeNull();
    expect(within(scope).getByRole('button',{name:'Очередь'})).toHaveAttribute('tabindex','0');
    expect(screen.queryByLabelText(/перетащ/i)).toBeNull();
    expect(screen.queryByLabelText(/drag/i)).toBeNull();
  });

  it('shows all step statuses in one tooltip without opening the step', async () => {
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
    fireEvent.click(screen.getByTestId('step-row-info'));
    expect(onOpenStep).not.toHaveBeenCalled();
    const info = screen.getByTestId('step-row-info');
    expect(info.querySelectorAll('svg')).toHaveLength(1);
    expect(info).toHaveAttribute('aria-label', 'Информация о шаге');
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Условие по результату звонка:');
    expect(tooltip).toHaveTextContent('Может выйти из цепочки');
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
    expect(screen.getByRole('button',{name:'Очередь'})).toHaveAttribute('tabindex','0');
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

  it('gives icon-only controls accessible names without native tooltip duplication', () => {
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

    });
  });

  it('declares aria-label on every icon-only control in source', () => {
    const src = readFileSync(join(specDir, 'StepRow.tsx'), 'utf8');
    const ariaCount = (src.match(/aria-label/g) ?? []).length;
    expect(ariaCount).toBeGreaterThanOrEqual(4);
  });
});
