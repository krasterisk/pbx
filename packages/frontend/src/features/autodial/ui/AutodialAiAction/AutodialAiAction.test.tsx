import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AutodialAiAction } from './AutodialAiAction';
const mocks = vi.hoisted(() => ({ configured: false, error: false, dispatch: vi.fn(), refetch: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppDispatch: () => mocks.dispatch, useAppSelector: () => 3 }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({ useGetAutodialCapabilitiesQuery: () => ({ currentData: { ai: { configured: mocks.configured } }, isError: mocks.error, isFetching: false, refetch: mocks.refetch }) }));
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => { mocks.configured = false; mocks.error = false; vi.clearAllMocks(); });
describe('autodial AI prerequisites', () => {
  it('explains the secure-context requirement before applying AI changes over a LAN HTTP origin', () => {
    mocks.configured = true; vi.stubGlobal('isSecureContext', false);
    render(<MemoryRouter><AutodialAiAction seed="Explain campaign" /></MemoryRouter>);
    expect(screen.getByText('autodial.workspace.aiSecureContextHint')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'autodial.workspace.askAi' })).toBeEnabled();
  });

  it('explains an unconfigured LLM before opening an assistant', () => {
    render(<MemoryRouter><AutodialAiAction seed="Explain campaign" /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'autodial.workspace.askAi' })).toBeDisabled();
    expect(screen.getByText('autodial.workspace.aiNotConfigured')).toBeInTheDocument();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it('distinguishes loading failure and retries the catalogue', () => {
    mocks.error = true;
    render(<MemoryRouter><AutodialAiAction seed="Explain campaign" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it('opens the assistant with context after configuration is present', () => {
    mocks.configured = true;
    render(<MemoryRouter><AutodialAiAction seed="Explain campaign" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.askAi' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ payload: 'Explain campaign' }));
  });
});
