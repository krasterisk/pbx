import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConditionEditor } from './ConditionEditor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

describe('ConditionEditor', () => {
  it('maps the queue-full preset to queuestatus FULL', () => {
    const onChange = vi.fn();
    render(<ConditionEditor value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить условие' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Выберите условие' }), {
      target: { value: 'queue-full' },
    });
    expect(onChange).toHaveBeenCalledWith({ source: 'queuestatus', values: ['FULL'] });
  });

  it('maps no-answer and busy presets', () => {
    const onChange = vi.fn();
    render(<ConditionEditor value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить условие' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Выберите условие' }), {
      target: { value: 'no-answer' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ source: 'dialstatus', values: ['NOANSWER'] });
    fireEvent.change(screen.getByRole('combobox', { name: 'Выберите условие' }), {
      target: { value: 'busy' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ source: 'dialstatus', values: ['BUSY'] });
  });

  it('keeps the preset when switching to expert and back without edits', () => {
    const value = { source: 'queuestatus' as const, values: ['FULL' as const] };
    const onChange = vi.fn();
    render(<ConditionEditor value={value} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Эксперт' }));
    expect(screen.getByDisplayValue('queuestatus')).toBeInTheDocument();
    expect(screen.getByDisplayValue('FULL')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Простой' }));
    expect(screen.getByRole('combobox', { name: 'Выберите условие' })).toHaveValue('queue-full');
  });
});
