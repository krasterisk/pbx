import { CallCenterWebrtcController } from './callcenter-webrtc.controller';

describe('CallCenterWebrtcController', () => {
  let controller: CallCenterWebrtcController;
  const saved: Record<string, string | undefined> = {};

  const ENV_KEYS = [
    'ASTERISK_WSS_URL',
    'WEBRTC_STUN_SERVERS',
    'WEBRTC_TURN_URL',
    'WEBRTC_TURN_USERNAME',
    'WEBRTC_TURN_PASSWORD',
  ] as const;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    controller = new CallCenterWebrtcController();
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

  it('returns ASTERISK_WSS_URL in wssUrl when set', () => {
    process.env.ASTERISK_WSS_URL = 'wss://pbx.example.com:8089/ws';
    const cfg = controller.getConfig();
    expect(cfg.wssUrl).toBe('wss://pbx.example.com:8089/ws');
  });

  it('returns null wssUrl when ASTERISK_WSS_URL is unset', () => {
    const cfg = controller.getConfig();
    expect(cfg.wssUrl).toBeNull();
  });

  it('without TURN env — only STUN in iceServers (no username/credential)', () => {
    const cfg = controller.getConfig();
    expect(cfg.iceServers.length).toBe(1);
    expect(cfg.iceServers[0].username).toBeUndefined();
    expect(cfg.iceServers[0].credential).toBeUndefined();
    const urls = cfg.iceServers[0].urls;
    const urlStr = Array.isArray(urls) ? urls.join(',') : urls;
    expect(urlStr).toContain('stun:');
  });

  it('with TURN env — TURN object present with username/credential', () => {
    process.env.WEBRTC_TURN_URL = 'turn:turn.example.com:3478';
    process.env.WEBRTC_TURN_USERNAME = 'turnuser';
    process.env.WEBRTC_TURN_PASSWORD = 'turnpass';
    const cfg = controller.getConfig();
    const turn = cfg.iceServers.find(
      (s) => s.username !== undefined || s.credential !== undefined,
    );
    expect(turn).toBeDefined();
    expect(turn!.urls).toBe('turn:turn.example.com:3478');
    expect(turn!.username).toBe('turnuser');
    expect(turn!.credential).toBe('turnpass');
  });

  it('applies default STUN when WEBRTC_STUN_SERVERS is unset', () => {
    const cfg = controller.getConfig();
    expect(cfg.iceServers[0].urls).toBe('stun:stun.l.google.com:19302');
  });

  it('parses comma-separated WEBRTC_STUN_SERVERS', () => {
    process.env.WEBRTC_STUN_SERVERS =
      'stun:stun1.example.com:3478, stun:stun2.example.com:3478';
    const cfg = controller.getConfig();
    expect(cfg.iceServers[0].urls).toEqual([
      'stun:stun1.example.com:3478',
      'stun:stun2.example.com:3478',
    ]);
  });
});
