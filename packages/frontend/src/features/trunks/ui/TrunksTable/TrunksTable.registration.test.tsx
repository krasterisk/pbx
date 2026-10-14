import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITrunkListItem } from '@/shared/api/endpoints/trunkApi';
import { TrunksTable } from './TrunksTable';
import { trunksPageActions } from '../../model/slice/trunksPageSlice';

const mocks = vi.hoisted(() => ({
  mobile: false,
  level: 1,
  dispatch: vi.fn(),
  register: vi.fn(),
  bulkRegister: vi.fn(),
  bulkDelete: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
const trunks = [
  { id: 'failed', name: 'Failed trunk', trunkType: 'auth', registrationStatus: 'Rejected', reachabilityStatus: 'Reachable', host: 'sip.example.test' },
  { id: 'registered', name: 'Registered trunk', trunkType: 'auth', registrationStatus: 'Registered', reachabilityStatus: 'Reachable', host: 'sip.example.test' },
  { id: 'ip', name: 'IP trunk', trunkType: 'ip', registrationStatus: null, reachabilityStatus: 'NoContacts', host: '' },
] as ITrunkListItem[];

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { count?: number; number?: number }) => options?.count != null ? `${key}:${options.count}` : options?.number != null ? `${key}:${options.number}` : key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppDispatch: () => mocks.dispatch, useAppSelector: () => mocks.level }));
vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: () => mocks.mobile }));
vi.mock('react-toastify', () => ({ toast: { success: mocks.success, error: mocks.error, info: mocks.info } }));
vi.mock('@/shared/api/endpoints/trunkApi', () => ({
  useGetTrunksQuery: () => ({ data: trunks, isLoading: false, isError: false, refetch: vi.fn() }),
  useDeleteTrunkMutation: () => [vi.fn()],
  useBulkDeleteTrunksMutation: () => [mocks.bulkDelete, { isLoading: false }],
  useRegisterTrunkMutation: () => [mocks.register],
  useBulkRegisterTrunksMutation: () => [mocks.bulkRegister],
}));

describe('TrunksTable registration controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mobile = false;
    mocks.level = 1;
    mocks.register.mockImplementation((id: string) => ({ unwrap: () => Promise.resolve({ id, status: 'requested' }) }));
    mocks.bulkRegister.mockImplementation((ids: string[]) => ({ unwrap: () => Promise.resolve({ results: ids.map((id) => ({ id, status: id === 'ip' ? 'skipped' : 'requested' })) }) }));
    mocks.bulkDelete.mockReturnValue({ unwrap: () => Promise.resolve({ deleted: 1 }) });
  });

  it.each([false, true])('offers the same individual action without opening the editor (mobile=%s)', async (mobile) => {
    mocks.mobile = mobile;
    render(<TrunksTable />);
    const action = screen.getByRole('button', { name: 'trunks.refreshRegistration' });
    expect(screen.getAllByRole('button', { name: 'trunks.refreshRegistration' })).toHaveLength(1);
    if (!mobile) {
      expect(screen.queryByRole('columnheader', { name: 'common.actions' })).not.toBeInTheDocument();
      const statusCell = action.closest('td');
      expect(statusCell).not.toBeNull();
      expect(within(statusCell!).getByRole('button', { name: /trunks.statusRejected/ })).toBeInTheDocument();
    }
    fireEvent.click(action);
    await act(async () => {});
    expect(mocks.register).toHaveBeenCalledWith('failed');
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith('trunks.registrationRequested');
  });

  it.each([false, true])('moves the action into the toolbar for a mixed selection (mobile=%s)', async (mobile) => {
    mocks.mobile = mobile;
    render(<TrunksTable />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.tableSelectRow:1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.tableSelectRow:3' }));
    expect(screen.queryByRole('button', { name: 'trunks.refreshRegistration' })).not.toBeInTheDocument();
    const action = screen.getByRole('button', { name: 'trunks.refreshSelectedRegistration' });
    fireEvent.click(action);
    await act(async () => {});
    expect(mocks.bulkRegister).toHaveBeenCalledWith(['failed', 'ip']);
    expect(mocks.success).toHaveBeenCalledWith('trunks.registrationRequestedCount:1');
    expect(mocks.info).toHaveBeenCalledWith('trunks.registrationSkippedCount:1');
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it.each([false, true])('offers toolbar copy only for one selected entity and no row copy/delete (mobile=%s)', (mobile) => {
    mocks.mobile = mobile;
    render(<TrunksTable />);
    expect(screen.queryByRole('button', { name: 'common.copy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^common.deleteSelected/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.tableSelectRow:1' }));
    expect(screen.getAllByRole('button', { name: 'common.copy' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.tableSelectRow:2' }));
    expect(screen.queryByRole('button', { name: 'common.copy' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.deleteSelected:2' })).toBeInTheDocument();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it.each([false, true])('copies the selected stable ID after search hides its row (mobile=%s)', (mobile) => {
    mocks.mobile = mobile;
    render(<TrunksTable />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.tableSelectRow:2' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'common.search' }), { target: { value: 'Failed' } });
    expect(screen.queryByText('Registered trunk')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.copy' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(trunksPageActions.openCopyModal(trunks[1]));
  });

  it('clears mobile selection through the real shared hook and restores individual registration', () => {
    mocks.mobile = true;
    render(<TrunksTable />);
    const checkbox = screen.getByRole('checkbox', { name: 'common.tableSelectRow:1' });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.deleteSelected:1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'trunks.refreshSelectedRegistration' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.selectionBannerClear' }));
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'common.copy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^common.deleteSelected/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'trunks.refreshSelectedRegistration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.selectionBannerClear' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'trunks.refreshRegistration' })).toBeInTheDocument();
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.bulkRegister).not.toHaveBeenCalled();
    expect(mocks.bulkDelete).not.toHaveBeenCalled();
  });

  it('keeps selected deletion behind the existing confirmation dialog', async () => {
    render(<TrunksTable />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.tableSelectRow:1' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.deleteSelected:1' }));
    expect(mocks.bulkDelete).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'trunks.deleteSelected:1' }));
    await act(async () => {});
    expect(mocks.bulkDelete).toHaveBeenCalledWith(['failed']);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('disables an IP-only selection with an accessible explanation', () => {
    render(<TrunksTable />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.tableSelectRow:3' }));
    expect(screen.getByRole('button', { name: 'trunks.refreshSelectedRegistration' })).toBeDisabled();
    expect(screen.getByLabelText('trunks.registrationNoEligible')).toHaveAttribute('tabindex', '0');
  });

  it('disables only the pending trunk and reports an individual request failure', async () => {
    let reject!: (reason: Error) => void;
    mocks.register.mockReturnValue({ unwrap: () => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }) });
    render(<TrunksTable />);
    const action = screen.getByRole('button', { name: 'trunks.refreshRegistration' });
    fireEvent.click(action);
    const pendingAction = screen.getByRole('button', { name: 'trunks.refreshRegistration' });
    expect(pendingAction).toBeDisabled();
    expect(pendingAction).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(pendingAction);
    expect(mocks.register).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error('AMI unavailable')));
    expect(mocks.error).toHaveBeenCalledWith('trunks.registrationFailed');
    expect(screen.getByRole('button', { name: 'trunks.refreshRegistration' })).toBeEnabled();
  });

  it('reports partial bulk errors separately from accepted requests', async () => {
    mocks.bulkRegister.mockReturnValue({ unwrap: () => Promise.resolve({ results: [{ id: 'failed', status: 'requested' }, { id: 'registered', status: 'failed', reason: 'ami_timeout' }] }) });
    render(<TrunksTable />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.tableSelectRow:1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.tableSelectRow:2' }));
    fireEvent.click(screen.getByRole('button', { name: 'trunks.refreshSelectedRegistration' }));
    await act(async () => {});
    expect(mocks.success).toHaveBeenCalledWith('trunks.registrationRequestedCount:1');
    expect(mocks.error).toHaveBeenCalledWith('trunks.registrationFailedCount:1');
  });

  it('hides registration operations from a non-admin viewer', () => {
    mocks.level = 2;
    render(<TrunksTable />);
    expect(screen.queryByRole('button', { name: 'trunks.refreshRegistration' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'common.tableSelectRow:1' }));
    expect(screen.queryByRole('button', { name: 'trunks.refreshSelectedRegistration' })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('trunks-table-scroll')).getByText('Failed trunk')).toBeInTheDocument();
  });
});
