import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lab = vi.hoisted(() => ({ ua: null as any, consults: [] as any[] }));
vi.mock('sip.js', async (importOriginal) => {
  const { Web } = await importOriginal<typeof import('sip.js')>();
  class Emitter {
    listeners: Array<(state: string) => void> = [];
    addListener(fn: (state: string) => void) { this.listeners.push(fn); }
    emit(state: string) { this.listeners.forEach(fn => fn(state)); }
  }
  class Session {
    state = 'Established';
    stateChange = new Emitter();
    sessionDescriptionHandler = { sendDtmf: vi.fn(() => false) };
    invite = vi.fn(async (_options?: any) => undefined);
    info = vi.fn(async () => undefined);
    refer = vi.fn(async (_target: any, _options?: any) => undefined);
    bye = vi.fn(async () => { this.state = 'Terminated'; this.stateChange.emit(this.state); });
  }
  class Invitation extends Session {
    remoteIdentity = { uri: { user: '204' } };
    accept = vi.fn(async () => undefined);
  }
  class Inviter extends Session {
    state = 'Initial';
    cancel = vi.fn(async () => { this.state = 'Terminated'; this.stateChange.emit(this.state); });
    constructor(..._args: any[]) { super(); lab.consults.push(this); }
  }
  class UserAgent {
    static makeURI = (value: string) => value;
    start = vi.fn(async () => undefined);
    stop = vi.fn(async () => undefined);
    constructor(public options: any) { lab.ua = this; }
  }
  class Registerer {
    stateChange = new Emitter();
    register = vi.fn(async () => this.stateChange.emit('Registered'));
    unregister = vi.fn(async () => undefined);
  }
  return { Session, Invitation, Inviter, UserAgent, Registerer, SessionState: { Established: 'Established', Terminated: 'Terminated', Initial: 'Initial' }, RegistererState: { Registered: 'Registered', Unregistered: 'Unregistered' }, Web: { ...Web, holdModifier: 'hold' } };
});

import { Invitation } from 'sip.js';
import { useWebRTCPhone } from './useWebRTCPhone';

async function setup() {
  const hook = renderHook(() => useWebRTCPhone({ server: 'wss://test', sipUser: '203', sipPassword: 'test-only', sipDomain: 'test', iceServers: [], remoteAudioRef: { current: null } }));
  await act(async () => hook.result.current.connect());
  const original = new (Invitation as any)();
  await act(async () => lab.ua.options.delegate.onInvite(original));
  await act(async () => hook.result.current.acceptCall());
  return { ...hook, original };
}

describe('WebRTC consultation lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers(); lab.consults = []; });
  afterEach(() => { vi.useRealTimers(); });
  it('keeps an incoming call ringing until SIP accepts and never revives a canceled invitation', async () => {
    const { result } = await setup();
    await act(async () => result.current.hangup());
    const incoming = new (Invitation as any)();
    let rejectAccept!: (error: Error) => void;
    incoming.accept.mockImplementation(() => new Promise((_resolve, reject) => { rejectAccept = reject; }));
    await act(async () => lab.ua.options.delegate.onInvite(incoming));
    let accepting!: Promise<void>;
    act(() => { accepting = result.current.acceptCall(); });
    expect(result.current.status).toBe('ringing');
    await act(async () => { incoming.state = 'Terminated'; incoming.stateChange.emit('Terminated'); rejectAccept(new Error('caller canceled')); await accepting; });
    expect(result.current.status).toBe('registered');
    expect(result.current.callInfo).toBeNull();
  });

  it('holds the client and waits for explicit completion after the destination answers', async () => {
    const { result, original } = await setup();
    await act(async () => result.current.attendedTransfer('202'));
    const consult = lab.consults[0];
    expect(original.invite).toHaveBeenCalledWith({ sessionDescriptionHandlerModifiers: ['hold'] });
    await act(async () => { consult.state = 'Established'; consult.stateChange.emit('Established'); });
    expect(result.current.consultation).toEqual({ target: '202', phase: 'connected' });
    expect(original.refer).not.toHaveBeenCalled();
    original.refer.mockImplementation(async (_target: any, options: any) => {
      options.onNotify({ accept: vi.fn(), request: { body: 'SIP/2.0 200 OK' } });
    });
    await act(async () => result.current.completeConsultation());
    expect(original.refer).toHaveBeenCalledWith(consult, expect.anything());
    expect(result.current.consultation).toBeNull();
    expect(result.current.status).toBe('registered');
  });

  it('cancel stops only the consultation and resumes the original client', async () => {
    const { result, original } = await setup();
    await act(async () => result.current.attendedTransfer('202'));
    await act(async () => result.current.cancelConsultation());
    expect(lab.consults[0].cancel).toHaveBeenCalled();
    expect(original.bye).not.toHaveBeenCalled();
    expect(original.invite).toHaveBeenLastCalledWith({ sessionDescriptionHandlerModifiers: [] });
    expect(result.current.isHeld).toBe(false);
  });

  it('busy and timeout restore the original client without REFER', async () => {
    const { result, original } = await setup();
    await act(async () => result.current.attendedTransfer('202'));
    const consult = lab.consults[0];
    const options = consult.invite.mock.calls[0][0];
    await act(async () => {
      options.requestDelegate.onReject({ message: { statusCode: 486 } });
      consult.state = 'Terminated'; consult.stateChange.emit('Terminated');
    });
    expect(result.current.consultationError).toBe('busy');
    expect(result.current.isHeld).toBe(false);
    await act(async () => result.current.attendedTransfer('202'));
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current.consultationError).toBe('timeout');
    expect(original.refer).not.toHaveBeenCalled();
    expect(original.bye).not.toHaveBeenCalled();
  });

  it('a rejected REFER preserves consultation and client so the operator can return', async () => {
    const { result, original } = await setup();
    await act(async () => result.current.attendedTransfer('202'));
    const consult = lab.consults[0];
    await act(async () => { consult.state = 'Established'; consult.stateChange.emit('Established'); });
    original.refer.mockImplementation(async (_target: any, options: any) => options.onNotify({ accept: vi.fn(), request: { body: 'SIP/2.0 486 Busy Here' } }));
    await act(async () => { await expect(result.current.completeConsultation()).rejects.toThrow('rejected'); });
    expect(original.bye).not.toHaveBeenCalled();
    expect(result.current.consultation?.phase).toBe('connected');
    await act(async () => result.current.cancelConsultation());
    expect(result.current.isHeld).toBe(false);
  });

  it('falls back to SIP INFO when the browser cannot send RTP DTMF', async () => {
    const { result, original } = await setup();
    await act(async () => result.current.sendDtmf('1'));
    expect(original.info).toHaveBeenCalledWith(expect.objectContaining({ requestOptions: expect.objectContaining({ body: expect.objectContaining({ content: 'Signal=1\r\nDuration=100' }) }) }));
  });
  it('appends a rapidly typed digit to tones still waiting for RTP transmission', async () => {
    const { result, original } = await setup();
    original.sessionDescriptionHandler.peerConnection = { getSenders: () => [{ track: { kind: 'audio' }, dtmf: { toneBuffer: '12' } }] };
    original.sessionDescriptionHandler.sendDtmf.mockReturnValue(true);
    await act(async () => result.current.sendDtmf('3'));
    expect(original.sessionDescriptionHandler.sendDtmf).toHaveBeenCalledWith('123');
    expect(original.info).not.toHaveBeenCalled();
  });
  it('does not end the client on a rejected blind REFER and waits for final NOTIFY on success', async () => {
    const { result, original } = await setup();
    original.refer.mockImplementationOnce(async (_target: any, options: any) => options.requestDelegate.onReject({ message: { reasonPhrase: 'Forbidden' } }));
    await act(async () => { await expect(result.current.blindTransfer('202')).rejects.toThrow('Forbidden'); });
    expect(original.bye).not.toHaveBeenCalled();
    original.refer.mockImplementationOnce(async (_target: any, options: any) => options.onNotify({ accept: vi.fn(), request: { body: 'SIP/2.0 200 OK' } }));
    await act(async () => result.current.blindTransfer('202'));
    expect(original.bye).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('registered');
  });
});
