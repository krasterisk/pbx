import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IEndpointListItem } from '@/shared/api/endpoints/endpointApi';
import type { IAgent } from '../../model/types/callCenterSchema';
import { CC_LAST_SHIFT_QUEUES_KEY } from '../../lib/shiftLoginQueues';
import { ShiftLoginForm } from './ShiftLoginForm';

const state = vi.hoisted(() => ({
  endpoints: [] as IEndpointListItem[], agents: [] as IAgent[],
  refreshEndpoints: vi.fn(), refreshDirectory: vi.fn(), credentials: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-redux', () => ({ useSelector: () => state.agents }));
vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: () => ({ data: state.endpoints, refetch: state.refreshEndpoints }),
  useLazyGetEndpointCredentialsQuery: () => [state.credentials],
}));
vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetTransferDirectoryQuery: () => ({ data: { endpoints: [] }, refetch: state.refreshDirectory }),
}));
vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: () => ({ data: [{ name: 'q8601_362', display_name: 'Test queue' }] }),
}));
const refreshAudio = vi.fn();
vi.mock('../../lib/useAudioDevices', () => ({
  useAudioDevices: () => ({ microphones: [], speakers: [], selectedMic: 'default', selectedSpeaker: 'default', setSelectedMic: vi.fn(), setSelectedSpeaker: vi.fn(), refresh: refreshAudio }),
  audioDeviceLabel: () => 'device',
}));
const phone = (overrides: Partial<IEndpointListItem> = {}) => ({
  id: 'e201_362', extension: '201', callerid: '"Test" <201>', status: 'online', webrtc_enabled: true,
  webrtc: { id: 'ew201_362', status: 'offline' }, ...overrides,
} as IEndpointListItem);
async function choosePhone(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'callcenter.softphone.selectExtension' }));
  await user.click(screen.getByRole('option', { name: 'Test (201)' }));
}
describe('shift entry eligibility and fresh validation', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear();
    localStorage.setItem(CC_LAST_SHIFT_QUEUES_KEY, JSON.stringify(['q8601_362']));
    state.agents = []; state.endpoints = [phone()];
    state.refreshEndpoints.mockImplementation(async () => ({ data: state.endpoints }));
    state.refreshDirectory.mockResolvedValue({ data: { endpoints: [] } });
  });
  it.each(['sip', 'webrtc'])('does not claim browser registration while starting a remote %s shift', async mode => {
    let complete!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>(resolve => { complete = resolve; }));
    const user = userEvent.setup(); render(<ShiftLoginForm active remoteAgent onConfirm={onConfirm} />);
    if (mode === 'webrtc') await user.click(screen.getByRole('radio', { name: /modeWebrtc/ }));
    await choosePhone(user);
    await user.click(screen.getByTestId('shift-login-submit'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('shift-login-submit')).toBeDisabled();
    expect(screen.getByTestId('shift-login-submit')).toHaveTextContent('callcenter.softphone.startingShift');
    expect(screen.getByTestId('shift-login-submit')).not.toHaveTextContent('callcenter.softphone.connecting');
    await act(async () => { complete(); });
    expect(screen.getByTestId('shift-login-submit')).toHaveTextContent('callcenter.softphone.startShift');
  });
  it('offers only registered, unoccupied, WebRTC-capable phones in browser mode', async () => {
    state.endpoints = [
      phone(),
      phone({ id: 'e202_362', extension: '202', status: 'offline' }),
      phone({ id: 'e203_362', extension: '203', webrtc_enabled: false, webrtc: null }),
      phone({ id: 'e204_362', extension: '204', webrtc: { id: 'ew204_362', status: 'online' } }),
    ];
    state.agents = [{ interface: 'PJSIP/e204_362', userId: 371, status: 'READY' } as IAgent];
    const user = userEvent.setup(); render(<ShiftLoginForm active remoteAgent onConfirm={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: /modeWebrtc/ }));
    await user.click(screen.getByRole('button', { name: 'callcenter.softphone.selectExtension' }));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Test (201)' })).toBeEnabled();
  });
  it.each([
    { message: 'Disconnect the ordinary telephone session first' },
    { message: ['Disconnect the ordinary telephone session first'] },
  ])('translates an ordinary telephone ownership conflict $message', async ({ message }) => {
    const onConfirm = vi.fn().mockRejectedValue({ data: { message } });
    const user = userEvent.setup();
    render(<ShiftLoginForm active remoteAgent onConfirm={onConfirm} />);
    await choosePhone(user);
    await user.click(screen.getByTestId('shift-login-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent('callcenter.softphone.ordinaryPhoneSessionActive');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Disconnect the ordinary');
    expect(screen.getByTestId('shift-login-submit')).toBeEnabled();
  });
  it('omits unregistered phones from SIP search and shows an empty result', async () => {
    state.endpoints = [phone({ status: 'offline' })];
    const user = userEvent.setup(); render(<ShiftLoginForm active remoteAgent onConfirm={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'callcenter.softphone.selectExtension' }));
    await user.type(screen.getByRole('combobox'), '201');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('common.noResults');
  });
  it('clears a SIP-only selection in WebRTC mode, excludes it from search and restores it to the SIP list', async () => {
    state.endpoints = [phone({ webrtc_enabled: false, webrtc: null })];
    const user = userEvent.setup(); render(<ShiftLoginForm active remoteAgent onConfirm={vi.fn()} />);
    await choosePhone(user);
    await user.click(screen.getByRole('radio', { name: /modeWebrtc/ }));
    expect(screen.getByTestId('shift-login-submit')).toBeDisabled();
    const trigger = screen.getByRole('button', { name: 'callcenter.softphone.selectExtension' });
    expect(trigger).not.toHaveTextContent('Test (201)');
    expect(trigger).not.toHaveTextContent('e201_362');
    await user.click(trigger);
    await user.type(screen.getByRole('combobox'), '201');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('radio', { name: /modeSip/ }));
    await user.click(trigger);
    expect(screen.getByRole('option', { name: 'Test (201)' })).toBeEnabled();
  });
  it('revalidates registration before starting, without requesting credentials for an offline number', async () => {
    const user = userEvent.setup(), onConfirm = vi.fn();
    render(<ShiftLoginForm active remoteAgent onConfirm={onConfirm} />);
    await choosePhone(user);
    state.refreshEndpoints.mockResolvedValue({ data: [phone({ status: 'offline' })] });
    await user.click(screen.getByTestId('shift-login-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent('unregistered');
    expect(onConfirm).not.toHaveBeenCalled(); expect(state.credentials).not.toHaveBeenCalled();
  });
  it('blocks a selection when an operator claims its companion after selection', async () => {
    const user = userEvent.setup(), onConfirm = vi.fn();
    const view = render(<ShiftLoginForm active remoteAgent onConfirm={onConfirm} />);
    await choosePhone(user);
    state.agents = [{ interface: 'PJSIP/ew201_362', userId: 371, status: 'PAUSED' } as IAgent];
    view.rerender(<ShiftLoginForm active remoteAgent onConfirm={onConfirm} />);
    expect(screen.getByTestId('shift-login-submit')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'callcenter.softphone.selectExtension' })).not.toHaveTextContent('Test (201)');
    await user.click(screen.getByRole('button', { name: 'callcenter.softphone.selectExtension' }));
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
  it('uses the actual companion id for a remote browser shift after refreshing availability', async () => {
    const user = userEvent.setup(), onConfirm = vi.fn();
    render(<ShiftLoginForm active remoteAgent onConfirm={onConfirm} />);
    await user.click(screen.getByRole('radio', { name: /modeWebrtc/ }));
    await choosePhone(user);
    await user.click(screen.getByTestId('shift-login-submit'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ mode: 'webrtc', interface: 'PJSIP/ew201_362', queues: ['q8601_362'] }));
    expect(state.refreshDirectory).toHaveBeenCalled(); expect(state.credentials).not.toHaveBeenCalled();
  });
  it('fails closed when availability cannot be refreshed and allows retry', async () => {
    const user = userEvent.setup(), onConfirm = vi.fn();
    render(<ShiftLoginForm active remoteAgent onConfirm={onConfirm} />);
    await choosePhone(user);
    state.refreshDirectory.mockResolvedValueOnce({ error: { status: 503 } });
    await user.click(screen.getByTestId('shift-login-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent('availabilityFailed');
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('shift-login-submit'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
  it('never invents a browser companion id when refreshed metadata has no companion', async () => {
    const user = userEvent.setup(), onConfirm = vi.fn();
    render(<ShiftLoginForm active remoteAgent onConfirm={onConfirm} />);
    await user.click(screen.getByRole('radio', { name: /modeWebrtc/ }));
    await choosePhone(user);
    state.refreshEndpoints.mockResolvedValue({ data: [phone({ webrtc_enabled: true, webrtc: null })] });
    await user.click(screen.getByTestId('shift-login-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent('webrtcNotEnabled');
    expect(onConfirm).not.toHaveBeenCalled(); expect(state.credentials).not.toHaveBeenCalled();
  });
});
