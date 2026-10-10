import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Sheet, SheetHeader, SheetTitle, SheetFooter, Dialog, DialogHeader, DialogTitle, DialogFooter, Input, Button } from '@/shared/ui';
import { FormDialogContent, FormSheetContent, ModalBody, ModalSection, ModalToggle, ModalTabs } from './ModalLayout';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('shared modal patterns', () => {
  it('keeps the header and save action outside the scrolling form body', () => {
    render(<Dialog open><FormDialogContent size="large" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Settings</DialogTitle></DialogHeader>
      <ModalBody><ModalSection title="Connection"><Input aria-label="Host" /></ModalSection></ModalBody>
      <DialogFooter><Button>Save</Button></DialogFooter>
    </FormDialogContent></Dialog>);
    const body = screen.getByLabelText('Host').closest('[data-modal-body]');
    expect(body).not.toContainElement(screen.getByRole('button', { name: 'Save' }));
    expect(body).not.toContainElement(screen.getByRole('heading', { name: 'Settings' }));
  });

  it('keeps drawer actions and title outside its scrolling fields', () => {
    render(<Sheet open><FormSheetContent aria-describedby={undefined}>
      <SheetHeader><SheetTitle>Contact</SheetTitle></SheetHeader>
      <ModalBody><ModalSection title="Details"><Input aria-label="Phone" /></ModalSection></ModalBody>
      <SheetFooter><Button>Save contact</Button></SheetFooter>
    </FormSheetContent></Sheet>);
    const body = screen.getByLabelText('Phone').closest('[data-modal-body]');
    expect(body).not.toContainElement(screen.getByRole('button', { name: 'Save contact' }));
    expect(body).not.toContainElement(screen.getByRole('heading', { name: 'Contact' }));
  });

  it('links the toggle label to the control and updates its local draft immediately', () => {
    function Form() {
      const [active, setActive] = useState(false);
      return <ModalToggle label="Active" checked={active} onCheckedChange={setActive} />;
    }
    render(<Form />);
    fireEvent.click(screen.getByText('Active'));
    expect(screen.getByRole('switch', { name: 'Active' })).toBeChecked();
  });

  it('collapses optional settings without clearing values kept by the form', () => {
    function Form() {
      const [value, setValue] = useState('');
      return <ModalSection title="Optional" collapsible>
        <Input aria-label="Value" value={value} onChange={e => setValue(e.target.value)} />
      </ModalSection>;
    }
    render(<Form />);
    const header = screen.getByRole('button', { name: 'Optional' });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(header);
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'draft' } });
    fireEvent.click(header);
    expect(screen.queryByLabelText('Value')).toBeNull();
    fireEvent.click(header);
    expect(screen.getByLabelText('Value')).toHaveValue('draft');
  });

  it('switches panels without an implicit save or losing the parent draft', () => {
    const save = vi.fn();
    function Form() {
      const [tab, setTab] = useState('main');
      const [value, setValue] = useState('');
      return <form onSubmit={save}>
        <ModalTabs items={[{ id: 'main', label: 'Main' }, { id: 'other', label: 'Other' }]}
          value={tab} onChange={setTab} label="Settings panels" />
        {tab === 'main' && <Input aria-label="Draft" value={value} onChange={e => setValue(e.target.value)} />}
      </form>;
    }
    render(<Form />);
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'unchanged' } });
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));
    fireEvent.click(screen.getByRole('button', { name: 'Main' }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Draft')).toHaveValue('unchanged');
  });
});
