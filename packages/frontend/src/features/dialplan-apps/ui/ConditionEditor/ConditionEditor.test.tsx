import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RECORD_STATUS_VALUES } from '@krasterisk/shared';
import { toConditionSource, toRouteCondition } from '../../model/conditionMap';
import { ConditionEditor, selectionToSource, sourceToSelection } from './ConditionEditor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'ru' },
  }),
}));

vi.mock('@/shared/api/endpoints/timeGroupApi', () => ({
  useGetTimeGroupsQuery: vi.fn(() => ({
    data: [{ uid: 3, name: 'Рабочие часы' }],
    isLoading: false,
  })),
}));

describe('ConditionEditor helpers', () => {
  it('encodes dial and queue sources for multi-select', () => {
    expect(sourceToSelection({ source: 'dialstatus', values: ['BUSY', 'NOANSWER'] })).toEqual([
      'dial:BUSY',
      'dial:NOANSWER',
    ]);
    expect(sourceToSelection({ source: 'queuestatus', values: ['FULL'] })).toEqual(['queue:FULL']);
  });

  it('encodes record_status OPERATOR distinctly from DTMF (D-56)', () => {
    const operator = sourceToSelection({ source: 'record_status', values: ['OPERATOR'] });
    const dtmf = sourceToSelection({ source: 'record_status', values: ['DTMF'] });
    expect(operator).toEqual(['record:OPERATOR']);
    expect(dtmf).toEqual(['record:DTMF']);
    expect(operator).not.toEqual(dtmf);

    const all = sourceToSelection({
      source: 'record_status',
      values: [...RECORD_STATUS_VALUES],
    });
    expect(all).toEqual(RECORD_STATUS_VALUES.map((value) => `record:${value}`));
    expect(all).toHaveLength(7);
  });

  it('round-trips record_status through selection and conditionMap', () => {
    const encoded = sourceToSelection({ source: 'record_status', values: ['OPERATOR'] });
    const source = selectionToSource(encoded, []);
    expect(source).toEqual({ source: 'record_status', values: ['OPERATOR'] });
    expect(toRouteCondition(source)).toEqual({ source: 'record_status', values: ['OPERATOR'] });
    expect(toConditionSource({ source: 'record_status', values: ['OPERATOR'] })).toEqual({
      source: 'record_status',
      values: ['OPERATOR'],
    });
  });

  it('keeps multiple dial statuses and drops the other group when mixed', () => {
    expect(
      selectionToSource(['dial:BUSY', 'dial:NOANSWER'], []),
    ).toEqual({ source: 'dialstatus', values: ['BUSY', 'NOANSWER'] });

    expect(
      selectionToSource(['dial:BUSY', 'queue:FULL'], ['dial:BUSY']),
    ).toEqual({ source: 'queuestatus', values: ['FULL'] });
  });
});

describe('ConditionEditor', () => {
  it('shows status and schedule field labels with tooltips', () => {
    render(<ConditionEditor condition={{}} onChange={vi.fn()} />);
    expect(screen.getByText('Результат предыдущего шага')).toBeInTheDocument();
    expect(screen.getByText('Расписание (группа времени)')).toBeInTheDocument();
  });

  it('emits time_group_uid when schedule changes', () => {
    const onChange = vi.fn();
    render(
      <ConditionEditor
        condition={{ source: 'dialstatus', values: ['BUSY'], dialstatus: 'BUSY' }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'dialstatus',
        time_group_uid: 3,
      }),
    );
  });

  it('does not show simple/expert mode toggle', () => {
    render(<ConditionEditor condition={{}} onChange={vi.fn()} />);
    expect(screen.queryByRole('tab', { name: 'Простой' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Эксперт' })).not.toBeInTheDocument();
  });
});
