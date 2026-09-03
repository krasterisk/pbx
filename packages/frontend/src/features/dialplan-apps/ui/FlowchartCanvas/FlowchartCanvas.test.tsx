import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { type ActionType, type IRouteAction } from '@krasterisk/shared';
import { ACTION_TYPES_LIST, dialplanAppsRegistry } from '../../model/registry';
import { FlowchartCanvas, hasActionCondition } from './FlowchartCanvas';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('react-to-print', () => ({
  useReactToPrint: () => vi.fn(),
}));

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

function makeAction(
  type: ActionType,
  overrides: Partial<IRouteAction> = {},
): IRouteAction {
  const config = dialplanAppsRegistry[type];
  return {
    id: overrides.id ?? `step-${type}`,
    type,
    params: overrides.params ?? config.defaultParams ?? {},
    condition: overrides.condition ?? {},
  };
}

describe('FlowchartCanvas', () => {
  it('renders the canvas figure from draft actions', () => {
    render(
      <FlowchartCanvas
        host="route"
        title="Inbound"
        patterns={['100']}
        actions={[makeAction('hangup')]}
      />,
    );

    const canvas = screen.getByTestId('flowchart-canvas');
    expect(canvas.tagName).toBe('FIGURE');
    expect(canvas).toHaveAttribute('data-host', 'route');
    expect(screen.getByTestId('flowchart-root')).toHaveTextContent('Входящий звонок');
    expect(screen.getByTestId('flowchart-node')).toBeInTheDocument();
  });

  it('draws a condition branch lane with success and otherwise labels', () => {
    render(
      <FlowchartCanvas
        actions={[
          makeAction('toqueue', {
            id: 'q1',
            condition: { dialstatus: 'NOANSWER' },
          }),
          makeAction('hangup', { id: 'h1' }),
        ]}
      />,
    );

    expect(screen.getByTestId('flowchart-edge-condition-met')).toHaveTextContent(
      'Условие выполнено',
    );
    expect(screen.getByTestId('flowchart-edge-otherwise')).toHaveTextContent('Иначе');
    expect(screen.getByTestId('flowchart-branch-lane')).toBeInTheDocument();
    expect(hasActionCondition(makeAction('toqueue', { condition: { dialstatus: 'NOANSWER' } }))).toBe(
      true,
    );
    expect(hasActionCondition(makeAction('hangup'))).toBe(false);
  });

  it('is read-only: nodes are not buttons and have no tabIndex', () => {
    render(<FlowchartCanvas actions={[makeAction('notify'), makeAction('hangup')]} />);

    const nodes = screen.getAllByTestId('flowchart-node');
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(node).not.toHaveAttribute('role', 'button');
      expect(node).not.toHaveAttribute('tabindex');
      expect(node).not.toHaveAttribute('tabIndex');
    }
    expect(screen.getByTestId('flowchart-print')).toBeInTheDocument();
    const nodeButtons = nodes.filter((node) => node.getAttribute('role') === 'button');
    expect(nodeButtons).toHaveLength(0);
  });

  it('uses registry summarize() for node body text', () => {
    const action = makeAction('hangup');
    const summary = dialplanAppsRegistry.hangup.summarize(
      action.params,
      (key, fallback) => (typeof fallback === 'string' ? fallback : key),
    );

    render(<FlowchartCanvas actions={[action]} />);
    expect(screen.getByTestId('flowchart-node')).toHaveTextContent(summary);
  });

  it('renders every ActionType as a node (completeness)', () => {
    const actions = ACTION_TYPES_LIST.map((config, index) =>
      makeAction(config.type, { id: `all-${index}` }),
    );

    render(<FlowchartCanvas actions={actions} />);

    const nodes = screen.getAllByTestId('flowchart-node');
    expect(nodes).toHaveLength(ACTION_TYPES_LIST.length);
    for (const config of ACTION_TYPES_LIST) {
      expect(screen.getAllByTestId('flowchart-node').some((node) => (
        node.getAttribute('data-action-type') === config.type
      ))).toBe(true);
    }
  });

  it('shows the empty state when the draft has no actions', () => {
    render(<FlowchartCanvas actions={[]} />);
    expect(screen.getByTestId('flowchart-empty')).toHaveTextContent('В маршруте нет действий');
  });

  it('applies five-channel highlight and Success on callback_requested', () => {
    const taken = makeAction('callback', { id: 'cb1' });
    const skipped = makeAction('hangup', { id: 'h1' });
    render(
      <FlowchartCanvas
        actions={[taken, skipped]}
        highlight={{
          segments: [
            {
              index: 0,
              entityKind: 'route',
              nodes: [{ order: '1.1', actionId: 'cb1', type: 'callback' }],
            },
          ],
          outcome: { kind: 'callback_requested', actionType: 'callback' },
        }}
      />,
    );

    const nodes = screen.getAllByTestId('flowchart-node');
    expect(nodes[0]).toHaveAttribute('data-highlight', 'success');
    expect(nodes[1]).toHaveAttribute('data-highlight', 'skipped');
    expect(screen.getByTestId('flowchart-order-chip')).toHaveTextContent('1.1');
    expect(screen.getByTestId('flowchart-not-taken')).toHaveTextContent('Не выполнялось');
  });
});
