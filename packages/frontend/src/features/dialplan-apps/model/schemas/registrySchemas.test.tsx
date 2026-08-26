import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { buildGotoSchema } from './goto';
import { httpRequestFieldErrors } from './httpRequest';
import { SchemaFields } from '../../ui/SchemaFields/SchemaFields';
import { StepRow } from '../../ui/StepRow/StepRow';
import { dialplanAppsRegistry } from '../registry';
import { ChainLabelsProvider } from '../chainLabels';

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
const t = (key: string, fallback?: string) => fallback ?? key;

describe('New action types UI (D-44 / D-45 / D-47 / D-49)', () => {
  it('goto lists only chain labels and has no free-text label field', () => {
    render(
      <ChainLabelsProvider labels={['start', 'end']}>
        <SchemaFields
          schema={buildGotoSchema(t)}
          params={{ label_name: 'start' }}
          onChange={noop}
        />
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
        <SchemaFields schema={buildGotoSchema(t)} params={{}} onChange={noop} />
      </ChainLabelsProvider>,
    );
    expect(screen.getByRole('combobox', { name: /метк/i })).toBeDisabled();
    expect(screen.getByText(/сначала.*метк/i)).toBeInTheDocument();
  });

  it('goto can show a conditional block with an else-label picker', () => {
    render(
      <ChainLabelsProvider labels={['ok', 'fail']}>
        <SchemaFields
          schema={buildGotoSchema(t)}
          params={{
            label_name: 'ok',
            condition: { source: 'variable', name: 'PIN', op: 'eq', value: '1' },
            false_label: 'fail',
          }}
          onChange={noop}
        />
      </ChainLabelsProvider>,
    );
    expect(screen.getByLabelText(/условный переход/i)).toBeChecked();
    expect(screen.getByRole('combobox', { name: /иначе/i })).toHaveValue('fail');
  });

  it('rejects an HTTP address that points at localhost', () => {
    const errors = httpRequestFieldErrors({ url: 'http://localhost/', method: 'GET', timeout: 5 });
    expect(errors.url).toBe('only-https');
    expect(httpRequestFieldErrors({ url: 'https://example.com/hook' })).toEqual({});
  });

  it('goto with a plain jump does not mark the next step unreachable', () => {
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
    expect(screen.queryByText('Завершает цепочку')).toBeNull();
    expect(screen.getByText('Может выйти из цепочки')).toBeInTheDocument();

    render(
      <StepRow
        action={{ id: 'p1', type: 'playback', params: { file: 'welcome' }, condition: {} }}
        index={1}
        onOpenStep={noop}
        onDuplicate={noop}
        onToggleEnabled={noop}
        onRemove={noop}
        onCopy={noop}
      />,
    );
    const rows = screen.getAllByTestId('step-row');
    expect(rows[1]).not.toHaveAttribute('data-unreachable', 'true');
  });

  it('summarize(totrunk) returns proper summary for single and carousel modes with CID', () => {
    const config = dialplanAppsRegistry.totrunk;
    expect(config.summarize({ trunk: 'PJSIP/trunk1' }, t)).toBe('Транк PJSIP/trunk1');
    expect(config.summarize({ trunk: 'PJSIP/trunk1', callerid: '79001234567' }, t)).toBe('Транк PJSIP/trunk1 (CID: 79001234567)');
    expect(config.summarize({ trunk: 'PJSIP/trunk1', cid_mode: 'phonebook' }, t)).toBe('Транк PJSIP/trunk1 (CID: справочник)');
    expect(config.summarize({ trunkMode: 'carousel', trunks: [{ trunk: 'PJSIP/t1' }] }, t)).toContain('1 транк(ов)');
  });

  it.each(['label', 'goto', 'schedule', 'http_request', 'collect_input', 'hangup', 'webhook', 'cmd'] as const)(
    'summarize(%s) returns a non-empty sentence for defaultParams',
    (type) => {
      const config = dialplanAppsRegistry[type];
      const summary = config.summarize(config.defaultParams ?? {}, t);
      expect(summary.trim().length).toBeGreaterThan(0);
    },
  );
});
