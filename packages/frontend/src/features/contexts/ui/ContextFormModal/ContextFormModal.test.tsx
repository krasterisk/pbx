import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContextFormModal } from './ContextFormModal';
import type { IContext } from '@/shared/api/api';

const mocks = vi.hoisted(() => ({
  rows: [] as IContext[],
  state: { contexts: { isModalOpen: true, selectedContext: null as IContext | null } },
  create: vi.fn(), update: vi.fn(), unwrap: vi.fn(), dispatch: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback || key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
  useAppDispatch: () => mocks.dispatch,
}));
vi.mock('@/shared/api/api', () => ({
  useGetContextsQuery: () => ({ data: mocks.rows, isSuccess: true }),
  useCreateContextMutation: () => [mocks.create, { isLoading: false }],
  useUpdateContextMutation: () => [mocks.update, { isLoading: false }],
  useApplyContextMutation: () => [vi.fn(), { isLoading: false }],
}));
const owner = { uid: 1, name: 'internal', comment: '', is_default_for_endpoints: true } as IContext;

describe('available default contexts in the modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows = [owner];
    mocks.state.contexts.selectedContext = null;
    mocks.unwrap.mockResolvedValue({});
    mocks.create.mockReturnValue({ unwrap: mocks.unwrap });
    mocks.update.mockReturnValue({ unwrap: mocks.unwrap });
  });
  it('hides occupied flags for a new context but keeps the free type', () => {
    render(<ContextFormModal />);
    expect(screen.queryByRole('switch', { name: 'contexts.defaultForEndpoints' })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'contexts.defaultForTrunks' })).toBeInTheDocument();
  });
  it('keeps the current owner flag visible and checked for deselection', async () => {
    mocks.state.contexts.selectedContext = owner;
    render(<ContextFormModal />);
    const flag = screen.getByRole('switch', { name: 'contexts.defaultForEndpoints' });
    expect(flag).toBeChecked();
    fireEvent.click(flag);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ uid: 1, data: expect.objectContaining({ is_default_for_endpoints: false }) }));
  });
  it('omits a draft flag that becomes occupied while the modal is open', async () => {
    mocks.rows = [];
    const view = render(<ContextFormModal />);
    fireEvent.change(screen.getByLabelText(/Имя контекста/), { target: { value: 'new-context' } });
    fireEvent.click(screen.getByRole('switch', { name: 'contexts.defaultForEndpoints' }));
    mocks.rows = [owner];
    view.rerender(<ContextFormModal />);
    expect(screen.queryByRole('switch', { name: 'contexts.defaultForEndpoints' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('is_default_for_endpoints');
  });

  it('blocks invalid characters in typing and paste, and validates separator placement before saving', () => {
    render(<ContextFormModal />);
    const input = screen.getByLabelText(/Имя контекста/);
    const save = screen.getByRole('button', { name: 'Сохранить' });
    expect(input).toHaveAttribute('maxlength', '64');
    expect(save).toBeDisabled();
    fireEvent.change(input, { target: { value: 'from-internal' } });
    expect(save).toBeEnabled();
    for (const name of ['two words', 'Межгород', 'Internal', 'a.b', 'a;evil', 'a'.repeat(65)]) {
      fireEvent.change(input, { target: { value: name } });
      expect(input).toHaveValue('from-internal');
    }
    fireEvent.change(input, { target: { value: 'internal-' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(save).toBeDisabled();
    fireEvent.change(input, { target: { value: 'access_national' } });
    expect(save).toBeEnabled();
  });
  it('keeps descriptions readable and hints hidden until their tooltip is opened', async () => {
    render(<ContextFormModal />);
    expect(screen.queryByText('contexts.identifierHint')).not.toBeInTheDocument();
    expect(screen.queryByText('contexts.descriptionHint')).not.toBeInTheDocument();
    expect(screen.queryByText('contexts.includesHint')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Имя контекста/), { target: { value: 'access-national' } });
    fireEvent.change(screen.getByLabelText(/Описание/), { target: { value: 'Межгород для отдела продаж' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'access-national', comment: 'Межгород для отдела продаж' })));
  });

});
