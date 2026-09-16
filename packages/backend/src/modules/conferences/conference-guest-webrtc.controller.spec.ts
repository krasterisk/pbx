import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { CallCenterWebrtcController } from '../callcenter/callcenter-webrtc.controller';
import { ConferenceGuestTokenGuard } from './conference-guest-token.guard';
import { ConferenceGuestWebrtcController } from './conference-guest-webrtc.controller';

describe('ConferenceGuestWebrtcController (16.1-03)', () => {
  const ENV_KEYS = [
    'ASTERISK_WSS_URL',
    'WEBRTC_STUN_SERVERS',
    'WEBRTC_TURN_URL',
    'WEBRTC_TURN_USERNAME',
    'WEBRTC_TURN_PASSWORD',
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it('GET :token/webrtc-config is guarded by ConferenceGuestTokenGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ConferenceGuestWebrtcController.prototype.getConfig,
    );
    expect(guards).toEqual(expect.arrayContaining([ConferenceGuestTokenGuard]));
    expect(Reflect.getMetadata(PATH_METADATA, ConferenceGuestWebrtcController.prototype.getConfig)).toBe(
      ':token/webrtc-config',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, ConferenceGuestWebrtcController.prototype.getConfig)).toBe(
      RequestMethod.GET,
    );
  });

  it('returns the same { wssUrl, iceServers } shape as callcenter webrtc config', () => {
    process.env.ASTERISK_WSS_URL = 'wss://pbx.example.com:8089/ws';
    process.env.WEBRTC_TURN_URL = 'turn:turn.example.com:3478';
    process.env.WEBRTC_TURN_USERNAME = 'turnuser';
    process.env.WEBRTC_TURN_PASSWORD = 'turnpass';

    const guest = new ConferenceGuestWebrtcController().getConfig();
    const staff = new CallCenterWebrtcController().getConfig();

    expect(Object.keys(guest).sort()).toEqual(['iceServers', 'wssUrl']);
    expect(guest).toEqual(staff);
    expect(guest).not.toHaveProperty('password');
    expect(guest).not.toHaveProperty('sipId');
  });

  it('rejects a missing token with 401 via ConferenceGuestTokenGuard', async () => {
    const guard = new ConferenceGuestTokenGuard({ findOne: jest.fn() } as any, { findOne: jest.fn() } as any);
    const req = { params: {}, user: undefined };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    };

    await expect(guard.canActivate(context as any)).rejects.toMatchObject({
      status: 401,
    });
  });
});
