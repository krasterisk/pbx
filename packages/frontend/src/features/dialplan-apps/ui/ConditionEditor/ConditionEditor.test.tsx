import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
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
