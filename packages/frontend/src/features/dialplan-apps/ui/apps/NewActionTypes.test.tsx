import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GotoApp } from './GotoApp/GotoApp';
import { BranchApp } from './BranchApp/BranchApp';
import { HttpRequestApp, httpRequestFieldErrors } from './HttpRequestApp/HttpRequestApp';
import { StepRow } from '../StepRow/StepRow';
import { dialplanAppsRegistry } from '../../model/registry';
import { ChainLabelsProvider } from '../../model/chainLabels';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/api/endpoints/promptsApi', () => ({
  useGetPromptsQuery: () => ({ data: [], isLoading: false }),
}));

const noop = () => undefined;

describe('New action types UI (D-44 / D-45 / D-47 / D-49)', () => {
  it('GotoApp lists only chain labels and has no free-text label field', () => {
    render(
      <ChainLabelsProvider labels={['start', 'end']}>
        <GotoApp params={{ label_name: 'start' }} onChange={noop} />
      </ChainLabelsProvider>,
    );
    const select = screen.getByRole('combobox', { name: /метк/i });
    const options = Array.from(select.querySelectorAll('option'))
      .map((opt) => opt.value)
      .filter(Boolean);
    expect(options).toEqual(['start', 'end']);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('disables the label select and explains when the chain has no labels', () => {
    render(
      <ChainLabelsProvider labels={[]}>
        <GotoApp params={{}} onChange={noop} />
      </ChainLabelsProvider>,
    );
    expect(screen.getByRole('combobox', { name: /метк/i })).toBeDisabled();
    expect(screen.getByText(/сначала.*метк/i)).toBeInTheDocument();
  });

  it('BranchApp renders ConditionEditor presets', () => {
    render(
      <ChainLabelsProvider labels={['ok', 'fail']}>
        <BranchApp
          params={{ true_label: 'ok', false_label: 'fail', condition: {} }}
          onChange={noop}
        />
      </ChainLabelsProvider>,
    );
    expect(screen.getByLabelText('Режим условий')).toBeInTheDocument();
  });

  it('marks an invalid HTTP address and does not call save', () => {
    const onSave = vi.fn();
    render(
      <HttpRequestApp
        params={{ url: 'http://localhost/', method: 'GET', timeout: 5 }}
        onChange={noop}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const errors = httpRequestFieldErrors({ url: 'http://localhost/', method: 'GET', timeout: 5 });
    if (Object.keys(errors).length === 0) onSave();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('goto renders the terminal badge and the next step is unreachable', () => {
    render(
      <StepRow
        action={{ id: 'g1', type: 'goto', params: { label_name: 'start' }, condition: {} }}
        index={0}
        onOpenStep={noop}
        onDuplicate={noop}
        onToggleEnabled={noop}
        onRemove={noop}
        onCopy={noop}
      />,
    );
    expect(screen.getByText('Завершает цепочку')).toBeInTheDocument();

    render(
      <StepRow
        action={{ id: 'p1', type: 'playback', params: { file: 'welcome' }, condition: {} }}
        index={1}
        unreachable
        onOpenStep={noop}
        onDuplicate={noop}
        onToggleEnabled={noop}
        onRemove={noop}
        onCopy={noop}
      />,
    );
    const rows = screen.getAllByTestId('step-row');
    expect(rows[1]).toHaveAttribute('data-unreachable', 'true');
  });

  it.each(['label', 'goto', 'branch', 'schedule', 'http_request', 'collect_input'] as const)(
    'summarize(%s) returns a non-empty sentence for defaultParams',
    (type) => {
      const config = dialplanAppsRegistry[type];
      const t = (key: string, fallback?: string | Record<string, unknown>) =>
        typeof fallback === 'string' ? fallback : key;
      const summary = config.summarize(config.defaultParams ?? {}, t);
      expect(summary.trim().length).toBeGreaterThan(0);
    },
  );
});
