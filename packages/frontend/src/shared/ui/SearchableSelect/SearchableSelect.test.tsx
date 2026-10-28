import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableSelect } from './SearchableSelect';

const options = [{ value: 'Asia/Krasnoyarsk', label: 'Asia / Krasnoyarsk (UTC+7)' }, { value: 'Europe/Moscow', label: 'Europe / Moscow (UTC+3)' }];
it('cannot select disabled items with Enter or pointer and skips them with arrows', async () => {
  const user = userEvent.setup(), onChange = vi.fn();
  render(<SearchableSelect value="" options={[{ value: 'busy', label: 'Busy', disabled: true }, { value: 'ready', label: 'Ready' }]}
    onChange={onChange} label="Phone" searchLabel="Search" emptyLabel="Empty" />);
  await user.click(screen.getByRole('button', { name: 'Phone' }));
  expect(screen.getByRole('option', { name: 'Busy' })).toBeDisabled();
  await user.keyboard('{Enter}');
  expect(onChange).not.toHaveBeenCalled();
  await user.keyboard('{ArrowDown}{Enter}');
  expect(onChange).toHaveBeenCalledWith('ready');
});
it('searches canonical values as well as labels, then selects with the keyboard', async () => {
  const user = userEvent.setup(), onChange = vi.fn();
  render(<SearchableSelect value="Europe/Moscow" options={options} onChange={onChange} label="Zone" searchLabel="Search zones" emptyLabel="No zones" />);
  await user.click(screen.getByRole('button', { name: 'Zone' }));
  await user.type(screen.getByRole('combobox'), 'Asia/Krasnoyarsk{Enter}');
  expect(onChange).toHaveBeenCalledWith('Asia/Krasnoyarsk');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('starts keyboard navigation on the selected value and supports Escape without changing it', async () => {
  const user = userEvent.setup(), onChange = vi.fn();
  render(<SearchableSelect value="Europe/Moscow" options={options} onChange={onChange} label="Zone" searchLabel="Search zones" emptyLabel="No zones" />);
  await user.click(screen.getByRole('button', { name: 'Zone' }));
  await user.keyboard('{ArrowUp}{Enter}');
  expect(onChange).toHaveBeenCalledWith('Asia/Krasnoyarsk');
  onChange.mockClear();
  await user.click(screen.getByRole('button', { name: 'Zone' }));
  await user.keyboard('{Escape}');
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
