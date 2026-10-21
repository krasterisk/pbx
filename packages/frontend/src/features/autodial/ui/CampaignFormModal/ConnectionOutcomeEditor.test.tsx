import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionOutcomeEditor } from './ConnectionOutcomeEditor';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('operator connection outcome', () => {
  it('requires explicit opt-in for a legacy queue and keeps the outcome code when editing its meaning', () => {
    const onChange = vi.fn(), view = render(<ConnectionOutcomeEditor step={1} value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.operatorConnection.enable' }));
    const value = onChange.mock.calls[0][0];
    expect(value).toMatchObject({ code: 'operator_connected', goal_relation: 'achieved' });
    view.rerender(<ConnectionOutcomeEditor step={1} value={value} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('autodial.workspace.outcomeDefinition.label'), { target: { value: 'Spoke to support' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...value, label: 'Spoke to support' });
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.operatorConnection.disable' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
