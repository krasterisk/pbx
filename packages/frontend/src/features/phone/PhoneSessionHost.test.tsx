import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneSessionHost } from './PhoneSessionHost';
import { PhoneNumber } from '@/entities/phone';
import { SoftphoneWidget } from '@/shared/ui/SoftphoneWidget';

const mocks = vi.hoisted(() => {
  const unwrap = (value: unknown) => ({ unwrap: async () => value });
  return {
    user: { uniqueid: 42, vpbx_user_uid: 7, level: 2 },
    phoneStatus: 'registered',
    data: { callCenterActive: false, callCenterPhone: null as { mode: 'sip' | 'webrtc'; extension: string } | null,
      endpoints: [{ id: 'e101_7', extension: '101', name: 'Alice', webrtc: true, available: true }] },
    owned: true, navigate: vi.fn(), refetch: vi.fn(),
    acquire: vi.fn(() => unwrap({ endpoint: 'e101_7', extension: '101', mode: 'sip', expiresAt: Date.now() + 120_000 })),
    heartbeat: vi.fn(() => ({ unwrap: async () => { throw { status: 409 }; } })),
    release: vi.fn(() => unwrap({ success: true })),
    runtime: vi.fn(() => unwrap({ credentials: { username: 'ew101_7', password: 'private', domain: 'pbx.test' }, wssUrl: 'wss://pbx.test/ws', iceServers: [] })),
    reset: vi.fn(), dial: vi.fn(() => unwrap({ success: true, mode: 'sip', target: '123' })),
    ccDial: vi.fn(() => unwrap({ success: true, mode: 'pjsip', target: '123' })),
    connect: vi.fn(), disconnect: vi.fn(), makeCall: vi.fn(),
  };
});
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', async (original) => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => mocks.navigate }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppSelector: (fn: any) => fn({ auth: { user: mocks.user } }) }));
vi.mock('@/shared/lib/telephony/useWebRTCPhone', () => ({ useWebRTCPhone: () => ({ status: mocks.phoneStatus, connect: mocks.connect,
  disconnect: mocks.disconnect, makeCall: mocks.makeCall }) }));
vi.mock('@/shared/api/endpoints/phoneSessionApi', () => ({
  usePhoneEndpointsQuery: () => ({ data: mocks.data, refetch: mocks.refetch }),
  useConnectPhoneMutation: () => [mocks.acquire, { isLoading: false }],
  useDisconnectPhoneMutation: () => [mocks.release], usePhoneHeartbeatMutation: () => [mocks.heartbeat],
  usePhoneCredentialsMutation: () => [mocks.runtime, { reset: mocks.reset }], usePhoneDialMutation: () => [mocks.dial, { isLoading: false }],
  usePhoneDialViaCallCenterMutation: () => [mocks.ccDial, { isLoading: false }],
}));
vi.mock('./PhoneTabs', () => ({ PhoneJournal: () => <span>ordinary-journal</span>, PhoneContacts: () => <span>ordinary-contacts</span> }));

function mount() { return render(<MemoryRouter><PhoneSessionHost><PhoneNumber number="123"/></PhoneSessionHost></MemoryRouter>); }
async function open() { await userEvent.click(screen.getByTestId('softphone-widget-trigger')); }
async function choose(mode = 'sip') {
  await open();
  fireEvent.change(screen.getByLabelText('phoneNumber.subscriber'), { target: { value: 'e101_7' } });
  if (mode !== 'sip') fireEvent.change(screen.getByLabelText('phoneNumber.device'), { target: { value: mode } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'phoneNumber.connect' })).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'phoneNumber.connect' }));
}
describe('ordinary-user work phone', () => {
  it('opens the common widget for an incoming ordinary WebRTC call', async () => {
    const acceptCall = vi.fn();
    render(<SoftphoneWidget autoOpenIncoming standaloneControls phone={{status:'ringing',callInfo:{from:'201'},isHeld:false,isMuted:false,
      makeCall:vi.fn(),hold:vi.fn(),unhold:vi.fn(),mute:vi.fn(),unmute:vi.fn(),hangup:vi.fn(),sendDtmf:vi.fn(),acceptCall}}/>);
    await userEvent.click(await screen.findByRole('button', {name:'callcenter.softphone.answer'}));
    expect(acceptCall).toHaveBeenCalledTimes(1);
  });
  it('uses shared call controls without mounting CC-only sections', async () => {
    const hold = vi.fn(), mute = vi.fn(), hangup = vi.fn();
    render(<SoftphoneWidget standaloneControls phone={{status:'in-call',callInfo:{to:'123'},isHeld:false,isMuted:false,
      makeCall:vi.fn(),hold,unhold:vi.fn(),mute,unmute:vi.fn(),hangup,sendDtmf:vi.fn()}}/>);
    await userEvent.click(screen.getByTestId('softphone-widget-trigger'));
    await userEvent.click(screen.getByRole('button', {name:'callcenter.softphone.hold'}));
    await userEvent.click(screen.getByRole('button', {name:'callcenter.softphone.mute'}));
    await userEvent.click(screen.getByRole('button', {name:'callcenter.softphone.hangup'}));
    expect(hold).toHaveBeenCalledTimes(1); expect(mute).toHaveBeenCalledTimes(1); expect(hangup).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('softphone-tab-journal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('softphone-tab-contacts')).not.toBeInTheDocument();
  });
  beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear(); mocks.phoneStatus = 'registered'; mocks.user.level = 2; mocks.data.callCenterActive = false; mocks.data.callCenterPhone = null; mocks.owned = true;
    mocks.data.endpoints = [{ id: 'e101_7', extension: '101', name: 'Alice', webrtc: true, available: true }];
    mocks.refetch.mockImplementation(async () => ({data:mocks.data}));
    mocks.acquire.mockImplementation(() => ({ unwrap: async () => ({ endpoint: 'e101_7', extension: '101', mode: 'sip', expiresAt: Date.now() + 120_000 }) }));
    Object.defineProperty(navigator, 'locks', { configurable: true, value: {
      request: vi.fn((_name, _options, fn) => fn(mocks.owned ? {} : null)),
    } });
  });
  it('connects a desk phone without creating a browser transport', async () => {
    mount(); await choose();
    await waitFor(() => expect(screen.getByTestId('softphone-widget-chrome')).toBeInTheDocument());
    expect(mocks.acquire).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'e101_7', mode: 'sip' }));
    expect(mocks.connect).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('callcenter.softphone.dialPlaceholder'), { target: { value: '123' } });
    await userEvent.click(screen.getByRole('button', { name: 'callcenter.softphone.dial' }));
    expect(mocks.dial).toHaveBeenCalledWith(expect.objectContaining({ number: '123' }));
    expect(mocks.makeCall).not.toHaveBeenCalled();
  });
  it('uses one common widget before login and filters WebRTC-capable available numbers', async () => {
    mocks.data.endpoints.push({id:'e102_7',extension:'102',name:'Desk',webrtc:false,available:true},
      {id:'e103_7',extension:'103',name:'Busy',webrtc:true,available:false});
    mount(); await open();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('softphone-widget-trigger')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('phoneNumber.device'), {target:{value:'webrtc'}});
    expect(screen.getByRole('option',{name:'101 · Alice'})).toBeInTheDocument();
    expect(screen.queryByRole('option',{name:'102 · Desk'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option',{name:'103 · Busy'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('softphone-tab-contacts'));
    expect(screen.getByText('ordinary-contacts')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('softphone-tab-journal'));
    expect(screen.getByText('ordinary-journal')).toBeInTheDocument();
  });
  it('rechecks availability immediately before connecting', async () => {
    mount(); await open();
    fireEvent.change(screen.getByLabelText('phoneNumber.subscriber'),{target:{value:'e101_7'}});
    mocks.refetch.mockResolvedValueOnce({data:{...mocks.data,endpoints:[{...mocks.data.endpoints[0],available:false}]}});
    await userEvent.click(screen.getByRole('button',{name:'phoneNumber.connect'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('phoneNumber.noLongerAvailable');
    expect(mocks.acquire).not.toHaveBeenCalled();
  });
  it('switches the number in the same widget and keeps the transport when the server rejects switching', async () => {
    mount(); await choose();
    mocks.data.endpoints.push({id:'e102_7',extension:'102',name:'Bob',webrtc:true,available:true});
    await userEvent.click(screen.getByRole('button',{name:'phoneNumber.change'}));
    fireEvent.change(screen.getByLabelText('phoneNumber.subscriber'),{target:{value:'e102_7'}});
    mocks.acquire.mockImplementationOnce(() => ({unwrap:async()=>{throw {data:{message:'busy'}};}}));
    mocks.disconnect.mockClear();
    await userEvent.click(screen.getByRole('button',{name:'phoneNumber.apply'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('busy');
    expect(mocks.release).not.toHaveBeenCalled(); expect(mocks.disconnect).not.toHaveBeenCalled();
    expect(screen.getByRole('button',{name:'phoneNumber.back'})).toBeInTheDocument();
  });
  it('closes phone settings so they cannot obscure incoming controls', async () => {
    mocks.acquire.mockImplementation(() => ({ unwrap: async () => ({ endpoint:'e101_7',extension:'101',mode:'webrtc',expiresAt:Date.now()+120_000 }) }));
    const view = mount(); await choose('webrtc');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', {name:'phoneNumber.change'}));
    expect(screen.getByLabelText('phoneNumber.subscriber')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    mocks.phoneStatus = 'ringing';
    view.rerender(<MemoryRouter><PhoneSessionHost><PhoneNumber number="123"/></PhoneSessionHost></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', {name:'callcenter.softphone.answer'})).toBeInTheDocument();
    expect(screen.queryByLabelText('phoneNumber.subscriber')).not.toBeInTheDocument();
  });
  it('retrieves WebRTC credentials only after acquiring ownership and immediately resets API cache', async () => {
    mocks.acquire.mockImplementation(() => ({ unwrap: async () => ({ endpoint: 'e101_7', extension: '101', mode: 'webrtc', expiresAt: Date.now() + 120_000 }) }));
    mount(); await choose('webrtc');
    await waitFor(() => expect(mocks.connect).toHaveBeenCalledWith(expect.objectContaining({ sipUser: 'ew101_7', sipPassword: 'private' })));
    expect(mocks.reset).toHaveBeenCalled();
    expect(JSON.stringify(sessionStorage)).not.toContain('private');
  });
  it('keeps failed WebRTC setup inside the widget with an explicit retry and disconnect', async () => {
    mocks.acquire.mockImplementationOnce(() => ({ unwrap:async()=>({endpoint:'e101_7',extension:'101',mode:'webrtc',expiresAt:Date.now()+120_000}) }));
    mocks.runtime.mockImplementationOnce(() => ({unwrap:async()=>{throw {data:{message:'runtime unavailable'}};}}));
    mount(); await choose('webrtc');
    expect(await screen.findByRole('alert')).toHaveTextContent('runtime unavailable');
    expect(screen.getByLabelText('phoneNumber.subscriber')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'phoneNumber.disconnect'})).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('does not mount the ordinary widget for readonly users', () => {
    mocks.user.level = 5; mount();
    expect(screen.queryByRole('button', { name: 'phoneNumber.widget' })).not.toBeInTheDocument();
    expect(mocks.heartbeat).not.toHaveBeenCalled();
  });
  it('does not mount a second widget during a CC shift and routes configuration to its panel', async () => {
    mocks.data.callCenterActive = true; mount();
    expect(screen.queryByRole('button', { name: 'phoneNumber.widget' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'phoneNumber.actionsFor' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'phoneNumber.connect' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/callcenter/agent');
    expect(mocks.acquire).not.toHaveBeenCalled();
  });
  it('blocks a second browser tab from acquiring the same transport', async () => {
    mocks.owned = false; mount(); await open();
    expect(screen.getByText('phoneNumber.otherTab')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('phoneNumber.subscriber'), { target: { value: 'e101_7' } });
    expect(screen.getByRole('button', { name: 'phoneNumber.connect' })).toBeDisabled();
    expect(mocks.acquire).not.toHaveBeenCalled();
  });
  it('recovers when a previous window lock is released after mounting', async () => {
    mocks.owned=false; mount(); await open();
    expect(screen.getByText('phoneNumber.otherTab')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('phoneNumber.subscriber'),{target:{value:'e101_7'}});
    mocks.owned=true;
    await waitFor(()=>expect(screen.getByRole('button',{name:'phoneNumber.connect'})).toBeEnabled(),{timeout:2500});
    expect(mocks.acquire).not.toHaveBeenCalled();
  });
  it('reuses an active CC desk phone through its existing permission-checked dial API', async () => {
    mocks.data.callCenterActive = true; mocks.data.callCenterPhone = { mode: 'sip', extension: '101' };
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'phoneNumber.actionsFor' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'phoneNumber.call' }));
    expect(mocks.ccDial).toHaveBeenCalledWith({ target: '123' });
    expect(mocks.acquire).not.toHaveBeenCalled(); expect(mocks.connect).not.toHaveBeenCalled();
  });
  it('does not start a browser phone when credentials arrive after logout or identity unmount', async () => {
    const original = mocks.runtime.getMockImplementation()!;
    let deliver!: (value: unknown) => void;
    const pending = new Promise((resolve) => { deliver = resolve; });
    mocks.runtime.mockImplementation(() => ({ unwrap: () => pending }));
    mocks.acquire.mockImplementation(() => ({ unwrap: async () => ({ endpoint: 'e101_7', extension: '101', mode: 'webrtc', expiresAt: Date.now() + 120_000 }) }));
    try {
      const view = mount(); await choose('webrtc');
      await waitFor(() => expect(mocks.runtime).toHaveBeenCalled());
      view.unmount();
      await act(async () => { deliver({ credentials: { username: 'ew101_7', password: 'private', domain: 'pbx.test' }, wssUrl: 'wss://pbx.test/ws', iceServers: [] }); await pending; });
      await waitFor(() => expect(mocks.reset).toHaveBeenCalled());
      expect(mocks.connect).not.toHaveBeenCalled();
    } finally { mocks.runtime.mockImplementation(original); }
  });
});
