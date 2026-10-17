import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/shared/api/endpoints/callCenterApi', () => ({ useSaveCardMutation: () => [mocks.save, { isLoading: false }] }));
import { CallCardForm, isFieldVisible } from './CallCardForm';

describe('call card answers and draft', () => {
  beforeEach(() => { mocks.save.mockReset(); mocks.save.mockImplementation(() => ({ unwrap: () => Promise.resolve({ uid: 1 }) })); });
  const template = { uid: 1, name: 'Card', is_active: true, auto_open_on: 'answer' as const, auto_save_on_timeout: true, fields: [{ field_key: 'name', field_type: 'text' as const, label: 'Name' }] };
  const context = { uniqueid: 'call.1', callerId: '202', queue: 'q701_0' };
  it('provides accessible field labels and saves an edited draft when wrap-up unmounts it', async () => {
    const { unmount } = render(<CallCardForm template={template} callContext={context} initialValues={{}} isVip={false} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Entered answer' } });
    unmount();
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', call_uniqueid: 'call.1', field_values: { name: 'Entered answer' } })));
  });
  it('does not overwrite a completed save with a draft when the form unmounts', async () => {
    const close = vi.fn();
    const { unmount } = render(<CallCardForm template={template} callContext={context} initialValues={{}} isVip={false} onClose={close} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Final' } });
    fireEvent.click(screen.getByTestId('call-card-save'));
    await waitFor(() => expect(close).toHaveBeenCalled()); unmount();
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it('uses codes from directory snapshots in conditional fields, including multiple selections', () => {
    const field = { ...template.fields[0], depends_on: 'topic', depends_values: ['consult'] };
    expect(isFieldVisible(field, { topic: { value: 'consult', label: 'Консультация' } })).toBe(true);
    expect(isFieldVisible(field, { topic: [{ value: 'consult', label: 'Консультация' }] })).toBe(true);
    expect(isFieldVisible(field, { topic: { value: 'other', label: 'consult' } })).toBe(false);
  });
  it('identifies and focuses the missing required field without sending an invalid save', () => {
    render(<CallCardForm template={{ ...template, fields: [{ ...template.fields[0], is_required: true }] }} callContext={context} initialValues={{}} isVip={false} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('call-card-save'));
    expect(screen.getByLabelText(/Name/)).toHaveFocus();
    expect(screen.getByLabelText(/Name/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('shows the saved wrap-up note even when the template contains only directory fields', () => {
    render(<CallCardForm template={template} callContext={context} initialValues={{ wrapup_note: 'Saved after retry' }} isVip={false} onClose={vi.fn()} />);
    expect(screen.getByText('Saved after retry')).toBeInTheDocument();
  });
});
