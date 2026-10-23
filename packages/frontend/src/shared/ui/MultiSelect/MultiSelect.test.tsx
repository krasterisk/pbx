import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MultiSelect } from './MultiSelect';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

function Harness() {
  const [value, setValue] = useState(['701']);
  return <MultiSelect value={value} onChange={setValue} options={[{value:'700',label:'Sales'},{value:'701',label:'Support'}]} ariaLabel="Queues"/>;
}

describe('MultiSelect accessible selection', () => {
  it('clears remote search when the dropdown closes',()=>{
    const search=vi.fn();render(<MultiSelect searchable onSearchChange={search} options={[{value:'201',label:'Alice'}]} value={[]} onChange={vi.fn()} ariaLabel="Employees"/>);
    fireEvent.click(screen.getByRole('button',{name:'Employees - Open'}));
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'201'}});expect(search).toHaveBeenLastCalledWith('201');
    fireEvent.keyDown(screen.getByRole('textbox'),{key:'Escape'});expect(search).toHaveBeenLastCalledWith('');
  });
  it('names removal controls and supports selecting and closing the list by keyboard', () => {
    render(<Harness/>);
    expect(screen.getByRole('button', { name: 'Clear selection: Support' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Queues - Open' }));
    expect(screen.getByRole('listbox', { name: 'Queues' }).getAttribute('aria-multiselectable')).toBe('true');
    const sales = screen.getByRole('option', { name: 'Sales' });
    fireEvent.keyDown(sales, { key: 'Enter' });
    expect(screen.getByRole('option', { name: 'Sales' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(sales, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('option', { name: 'Support' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Queues - Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection: Support' }));
    expect(screen.queryByText('Support')).toBeNull();
  });
});
