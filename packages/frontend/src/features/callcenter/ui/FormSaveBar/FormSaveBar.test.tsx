import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter, Link } from 'react-router-dom';
import '@testing-library/jest-dom';
import { FormSaveBar } from './FormSaveBar';

function Page({ onSave }: { onSave: () => void }) {
  const [dirty, setDirty] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setDirty(true)}>edit</button>
      <Link to="/other">go</Link>
      <FormSaveBar dirty={dirty} onSave={() => { onSave(); setDirty(false); }} onCancel={() => setDirty(false)} />
    </div>
  );
}

function setup(onSave = vi.fn()) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Page onSave={onSave} /> },
      { path: '/other', element: <div data-testid="other">other</div> },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  return { router, onSave };
}

describe('FormSaveBar (U5.4)', () => {
  it('shows the sticky bar only when dirty; Cancel reverts', () => {
    setup();
    expect(screen.queryByTestId('cc-form-save-bar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('edit'));
    expect(screen.getByTestId('cc-form-save-bar')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cc-form-save-bar-cancel'));
    expect(screen.queryByTestId('cc-form-save-bar')).not.toBeInTheDocument();
  });

  it('leaving with unsaved changes asks for confirmation; Stay keeps the page, Leave navigates', async () => {
    setup();
    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(screen.getByText('go'));
    expect(await screen.findByTestId('cc-form-save-bar-leave-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cc-form-save-bar-stay'));
    await waitFor(() => expect(screen.queryByTestId('cc-form-save-bar-leave-dialog')).not.toBeInTheDocument());
    expect(screen.queryByTestId('other')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('go'));
    fireEvent.click(await screen.findByTestId('cc-form-save-bar-leave'));
    expect(await screen.findByTestId('other')).toBeInTheDocument();
  });

  it('navigates freely when the form is clean', async () => {
    setup();
    fireEvent.click(screen.getByText('go'));
    expect(await screen.findByTestId('other')).toBeInTheDocument();
  });
});
