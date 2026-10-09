import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { ExtensionChips } from './ExtensionChips';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
function Fixture({ pending = vi.fn(), changed = vi.fn() }) {
  const [value, setValue] = useState(['100']);
  return (
    <ExtensionChips
      value={value}
      onChange={(next) => {
        setValue(next);
        changed(next);
      }}
      onDraftChange={pending}
    />
  );
}
describe('inline dial rule editor', () => {
  it('interprets a legacy blank Caller ID as any caller in the new editor', () => {
    const changed = vi.fn();
    render(<ExtensionChips value={['100/']} onChange={changed} />);
    expect(screen.getByLabelText('routes.callerNumberPattern')).toHaveValue('');
    expect(changed).toHaveBeenCalledWith(['100']);
  });
  it('edits two fields, adds a pair and serializes an empty Caller ID as any', () => {
    const changed = vi.fn();
    render(<Fixture changed={changed} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('routes.callerNumberPattern'), {
      target: { value: '_2XX' },
    });
    expect(changed).toHaveBeenLastCalledWith(['100/_2XX']);
    fireEvent.click(screen.getByRole('button', { name: 'routes.addDialRule' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
    const headings = within(screen.getByTestId('dial-rule-headings'));
    expect(headings.getAllByText('routes.destinationPattern')).toHaveLength(1);
    expect(headings.getAllByText('routes.callerNumberPattern')).toHaveLength(1);
    expect(screen.queryByText('routes.extensions')).not.toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText('routes.destinationPattern')[1], {
      target: { value: '200' },
    });
    expect(changed).toHaveBeenLastCalledWith(['100/_2XX', '200']);
    fireEvent.change(screen.getAllByLabelText('routes.callerNumberPattern')[0], {
      target: { value: '' },
    });
    expect(changed).toHaveBeenLastCalledWith(['100', '200']);
    fireEvent.click(screen.getAllByRole('button', { name: 'routes.removeDialRule' })[0]);
    expect(changed).toHaveBeenLastCalledWith(['200']);
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });
  it('blocks injection, incomplete rows and duplicate pairs during editing', () => {
    const pending = vi.fn();
    const changed = vi.fn();
    render(<Fixture pending={pending} changed={changed} />);
    fireEvent.change(screen.getByLabelText('routes.destinationPattern'), {
      target: { value: '100,1,evil' },
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(pending).toHaveBeenLastCalledWith(true);
    expect(changed).toHaveBeenLastCalledWith([]);
    fireEvent.change(screen.getByLabelText('routes.destinationPattern'), {
      target: { value: '100' },
    });
    expect(pending).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'routes.addDialRule' }));
    fireEvent.change(screen.getAllByLabelText('routes.callerNumberPattern')[1], {
      target: { value: '201' },
    });
    expect(pending).toHaveBeenLastCalledWith(true);
    fireEvent.change(screen.getAllByLabelText('routes.destinationPattern')[1], {
      target: { value: '100' },
    });
    expect(pending).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getAllByLabelText('routes.callerNumberPattern')[1], {
      target: { value: '' },
    });
    expect(pending).toHaveBeenLastCalledWith(true);
  });
  it('starts with one pair and refreshes externally loaded disabled values', () => {
    const changed = vi.fn();
    const { rerender } = render(<ExtensionChips value={[]} onChange={changed} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    rerender(<ExtensionChips value={['300/_3XX', '400']} onChange={changed} disabled />);
    expect(screen.getAllByLabelText('routes.destinationPattern')[0]).toHaveValue('300');
    expect(screen.getAllByLabelText('routes.callerNumberPattern')[0]).toHaveValue('_3XX');
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
    expect(screen.getAllByRole('textbox').every((input) => input.hasAttribute('disabled'))).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: 'routes.addDialRule' })).not.toBeInTheDocument();
  });
});
