import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { type IRouteAction } from '@krasterisk/shared';
import type { IDryRunResult } from '@/shared/api/endpoints/dryRunApi';
import { DryRunForm } from './DryRunForm';
import { collectConditionSources } from './collectConditionSources';

const { postDryRun } = vi.hoisted(() => ({
  postDryRun: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/api/endpoints/dryRunApi', () => ({
  usePostDryRunMutation: () => [postDryRun, { isLoading: false, isError: false }],
}));

function action(partial: Partial<IRouteAction> & Pick<IRouteAction, 'id' | 'type'>): IRouteAction {
  return {
    params: {},
    condition: {},
    ...partial,
  };
}

const callbackResult: IDryRunResult = {
  segments: [
    {
      index: 0,
      entityKind: 'route',
      entityName: 'Inbound',
      nodes: [{ order: '1.1', actionId: 'cb1', type: 'callback' }],
    },
  ],
  breadcrumbs: [{ entityKind: 'route', entityName: 'Inbound' }],
  hopsUsed: 0,
  hopLimit: 10,
  outcome: { kind: 'callback_requested', actionType: 'callback' },
};

describe('collectConditionSources', () => {
  it('returns one control per source the draft actually reads', () => {
    expect(
      collectConditionSources([
        action({ id: 'a', type: 'toqueue', condition: { source: 'dialstatus', values: ['NOANSWER'] } }),
        action({ id: 'b', type: 'hangup', condition: { source: 'dialstatus', values: ['BUSY'] } }),
        action({ id: 'c', type: 'playback', condition: { time_group_uid: 3 } }),
      ]),
    ).toEqual([
      { kind: 'dialstatus', name: undefined, device: undefined },
      { kind: 'schedule' },
    ]);
  });
});

describe('DryRunForm', () => {
  beforeEach(() => {
    postDryRun.mockReset();
    postDryRun.mockReturnValue({
      unwrap: () => Promise.resolve(callbackResult),
    });
  });

  it('is collapsed by default and exposes dry-run-form', () => {
    render(<DryRunForm host="route" actions={[action({ id: 'h1', type: 'hangup' })]} />);
    expect(screen.getByTestId('dry-run-form')).toBeInTheDocument();
    expect(screen.queryByTestId('dry-run-body')).not.toBeInTheDocument();
    expect(screen.getByTestId('dry-run-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders ConditionEditor preset labels for a dialstatus source', () => {
    render(
      <DryRunForm
        host="route"
        actions={[
          action({
            id: 'q1',
            type: 'toqueue',
            condition: { source: 'dialstatus', values: ['NOANSWER'] },
          }),
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId('dry-run-toggle'));
    const select = screen.getByTestId('dry-run-source-dialstatus');
    expect(select).toBeInTheDocument();
    expect(select).toHaveTextContent('Не отвечает');
    expect(select).toHaveTextContent('Ответили');
    expect(select).toHaveTextContent('Занято');
  });

  it('posts draft actions and announces callback outcome first', async () => {
    const onResultChange = vi.fn();
    const draft = [
      action({ id: 'cb1', type: 'callback' }),
      action({ id: 'h1', type: 'hangup' }),
    ];
    render(
      <DryRunForm host="route" actions={draft} entityName="Inbound" onResultChange={onResultChange} />,
    );
    fireEvent.click(screen.getByTestId('dry-run-toggle'));
    fireEvent.change(screen.getByTestId('dry-run-caller'), { target: { value: '79001234567' } });
    fireEvent.click(screen.getByTestId('dry-run-run'));

    await waitFor(() => {
      expect(postDryRun).toHaveBeenCalled();
    });
    const body = postDryRun.mock.calls[0][0];
    expect(body.host).toBe('route');
    expect(body.callerNumber).toBe('79001234567');
    expect(body.actions.map((item: { id: string }) => item.id)).toEqual(['cb1', 'h1']);

    const live = await screen.findByTestId('dry-run-outcome');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('Итог: абонент заказал обратный звонок');
    expect(onResultChange).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: expect.objectContaining({ kind: 'callback_requested' }) }),
    );
  });

  it('renders IVR digit options plus always-present timeout and invalid, and a pass input when max_count > 0', () => {
    render(
      <DryRunForm
        host="ivr"
        maxCount={3}
        menuItems={[
          { digit: '1', actions: [action({ id: 'h1', type: 'hangup' })] },
          { digit: '_XXX', actions: [action({ id: 'h2', type: 'hangup' })] },
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId('dry-run-toggle'));
    const choice = screen.getByTestId('dry-run-ivr-choice');
    expect(choice).toHaveTextContent('Нажал кнопку 1');
    expect(choice).toHaveTextContent('Набрал номер по шаблону _XXX');
    expect(choice).toHaveTextContent('Ничего не нажал');
    expect(choice).toHaveTextContent('Нажал кнопку, которой нет в меню');
    expect(screen.getByTestId('dry-run-ivr-pass')).toBeInTheDocument();
  });

  it('renders stacked segment cards and hop-limit copy, never tabs', async () => {
    const multi: IDryRunResult = {
      segments: [
        {
          index: 0,
          entityKind: 'ivr',
          entityName: 'Main',
          nodes: [{ order: '1.1', actionId: 'a1', type: 'toivr' }],
        },
        {
          index: 1,
          entityKind: 'route',
          entityName: 'Night',
          nodes: [{ order: '2.1', actionId: 'b1', type: 'hangup' }],
        },
      ],
      breadcrumbs: [
        { entityKind: 'ivr', entityName: 'Main' },
        { entityKind: 'route', entityName: 'Night' },
      ],
      hopsUsed: 10,
      hopLimit: 10,
      outcome: { kind: 'congestion' },
    };
    postDryRun.mockReturnValue({ unwrap: () => Promise.resolve(multi) });

    render(
      <DryRunForm
        host="ivr"
        menuItems={[{ digit: '1', actions: [action({ id: 'a1', type: 'toivr' })] }]}
      />,
    );
    fireEvent.click(screen.getByTestId('dry-run-toggle'));
    fireEvent.change(screen.getByTestId('dry-run-ivr-choice'), { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('dry-run-run'));

    expect(await screen.findByTestId('dry-run-segments')).toBeInTheDocument();
    expect(screen.getAllByTestId('dry-run-segment')).toHaveLength(2);
    expect(screen.getByTestId('dry-run-breadcrumbs')).toBeInTheDocument();
    expect(screen.getByTestId('dry-run-hop-limit')).toHaveTextContent('10');
    expect(screen.queryByRole('tablist', { name: /segment/i })).toBeNull();
    expect(screen.getByText('2.1')).toBeInTheDocument();
  });
});
