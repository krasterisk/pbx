import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, Dialog, DialogTitle, FormDialogContent } from '@/shared/ui';
import { useAutodialDialogFocus } from './useAutodialDialogFocus';

function Harness() {
  const [open, setOpen] = useState(false), focus = useAutodialDialogFocus();
  return <><Button onClick={() => setOpen(true)}>Edit customer</Button>
    <Dialog open={open} onOpenChange={setOpen}><FormDialogContent {...focus} aria-describedby={undefined}>
      <DialogTitle>Customer</DialogTitle><Button onClick={() => setOpen(false)}>Cancel edit</Button>
    </FormDialogContent></Dialog></>;
}

function AsyncHarness({ response }: { response: Promise<void> }) {
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false);
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);
  const focus = useAutodialDialogFocus(opener);
  return <><Button disabled={pending} onClick={async (event) => {
    setOpener(event.currentTarget); setPending(true);
    await response; setPending(false); setOpen(true);
  }}>Preview schema</Button>
    <Dialog open={open} onOpenChange={setOpen}><FormDialogContent {...focus} aria-describedby={undefined}>
      <DialogTitle>Schema preview</DialogTitle><Button onClick={() => setOpen(false)}>Cancel preview</Button>
    </FormDialogContent></Dialog></>;
}
describe('controlled Autodial dialog focus', () => {
  it('returns to an async opener after it was disabled and browser focus moved to the body', async () => {
    let complete!: () => void;
    const response = new Promise<void>((resolve) => { complete = resolve; });
    render(<AsyncHarness response={response} />);
    const trigger = screen.getByRole('button', { name: 'Preview schema' });
    trigger.focus(); fireEvent.click(trigger);
    expect(trigger).toBeDisabled();
    // JSDOM refuses blur() on a disabled button; model Chromium's body focus.
    document.body.tabIndex = -1; document.body.focus(); document.body.removeAttribute('tabindex');
    expect(document.activeElement).toBe(document.body);
    await act(async () => { complete(); await response; });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel preview' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Schema preview' })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('returns keyboard focus to the initiating control after closing', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Edit customer' });
    trigger.focus(); fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel edit' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Customer' })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
