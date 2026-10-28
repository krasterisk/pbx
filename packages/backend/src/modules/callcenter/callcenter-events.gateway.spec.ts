import { JwtService } from '@nestjs/jwt';
import { Subject, throwError } from 'rxjs';
import { CallCenterEventsGateway } from './callcenter-events.gateway';

const secret = 'fixture-callcenter-secret-at-least-32-characters';
const user = { sub: 42, level: 2, vpbx_user_uid: 91 };
const socket = (token?: string) => ({
  handshake: { auth: { token } },
  data: {} as any,
  emit: jest.fn(),
  disconnect: jest.fn(),
});

describe('Call center authenticated event gateway', () => {
  const config: any = { get: () => secret };
  let stream: Subject<any>,
    events: any,
    gateway: CallCenterEventsGateway,
    middleware: any;
  const token = (claims = user, options: any = {}) =>
    new JwtService().sign(claims, {
      secret,
      issuer: 'krasterisk-v4',
      audience: 'krasterisk-v4-client',
      expiresIn: '2h',
      ...options,
    });
  const admit = (client: any) => {
    const next = jest.fn();
    middleware(client, next);
    return next;
  };
  beforeEach(() => {
    jest.useFakeTimers();
    stream = new Subject();
    events = { events: jest.fn(() => stream) };
    gateway = new CallCenterEventsGateway(config, events);
    gateway.afterInit({
      use: (fn: any) => {
        middleware = fn;
      },
    } as any);
  });
  afterEach(() => {
    gateway.onModuleDestroy();
    jest.useRealTimers();
  });

  it('rejects missing, expired, wrong-signature/issuer/audience and invalid-payload credentials before subscribing', () => {
    for (const value of [
      undefined,
      'bad',
      token(user, { expiresIn: -1 }),
      token(user, { secret: 'another-fixture-secret' }),
      token(user, { issuer: 'other' }),
      token(user, { audience: 'other' }),
      token({ ...user, sub: 0 }),
    ]) {
      expect(admit(socket(value))).toHaveBeenCalledWith(expect.any(Error));
    }
    expect(events.events).not.toHaveBeenCalled();
  });
  it('uses only the verified identity for the same authorized stream and never broadcasts across clients', () => {
    const client: any = socket(token());
    expect(admit(client)).toHaveBeenCalledWith();
    gateway.handleConnection(client);
    expect(events.events).toHaveBeenCalledWith(expect.objectContaining(user));
    stream.next({ type: 'fullSnapshot', data: '{"agents":[]}' });
    expect(client.emit).toHaveBeenCalledWith('cc:event', {
      type: 'fullSnapshot',
      data: '{"agents":[]}',
    });
    gateway.handleDisconnect(client);
    gateway.handleDisconnect(client);
    stream.next({ type: 'heartbeat', data: '1' });
    expect(client.emit).toHaveBeenCalledTimes(1);
    expect(stream.observed).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('disconnects at token expiry and releases the subscription on disconnect', () => {
    const client: any = socket(token(user, { expiresIn: 1 }));
    admit(client);
    gateway.handleConnection(client);
    jest.advanceTimersByTime(1001);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    gateway.handleDisconnect(client);
    expect(stream.observed).toBe(false);
  });
  it('handles synchronous stream failure without an uncaught error or leaked client', () => {
    events.events.mockReturnValue(
      throwError(() => new Error('fixture failure')),
    );
    const client: any = socket(token());
    admit(client);
    expect(() => gateway.handleConnection(client)).not.toThrow();
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
