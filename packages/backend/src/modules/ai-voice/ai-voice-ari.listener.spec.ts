import { AiVoiceAriListener } from './ai-voice-ari.listener';
import { resolveAiVoiceAriAppName } from '../ari/ari-event-classifier';

const app = resolveAiVoiceAriAppName();

function fixture() {
  const ari = {
    answerChannel: jest.fn().mockResolvedValue(undefined),
    setChannelVar: jest.fn().mockResolvedValue(undefined),
    playMedia: jest.fn().mockResolvedValue('playback'),
    continueInDialplan: jest.fn().mockResolvedValue(undefined),
    hangupChannel: jest.fn().mockResolvedValue(undefined),
    getChannelVar: jest.fn().mockResolvedValue(''),
  };
  const robots = { get: jest.fn().mockResolvedValue({ uid: 12, config: { enabled: true } }) };
  return { ari, robots, listener: new AiVoiceAriListener(ari as any, robots as any) };
}

describe('AiVoiceAriListener', () => {
  it('admits only its dedicated ARI application with an explicitly owned tenant', async () => {
    const f = fixture();
    await f.listener.onStart({ application: app, args: ['robot:12'], channel: {
      id: 'channel-1', channelvars: { VPBX_USER_UID: '7' },
    } });

    expect(f.robots.get).toHaveBeenCalledWith(7, 12);
    expect(f.ari.answerChannel).toHaveBeenCalledWith('channel-1');
    expect(f.ari.setChannelVar).toHaveBeenNthCalledWith(2, 'channel-1', 'AI_ROBOT_OUTCOME', 'completed');
    expect(f.ari.continueInDialplan).toHaveBeenCalledWith('channel-1');
  });

  it('loads the inherited tenant variable when StasisStart omits channelvars', async () => {
    const f = fixture();
    f.ari.getChannelVar.mockResolvedValue('42');
    await f.listener.onStart({ application: app, args: ['robot:12'], channel: { id: 'channel-2' } });

    expect(f.ari.getChannelVar).toHaveBeenCalledWith('channel-2', 'VPBX_USER_UID');
    expect(f.robots.get).toHaveBeenCalledWith(42, 12);
  });

  it('fails closed instead of defaulting a channel without a tenant to tenant zero', async () => {
    const f = fixture();
    await f.listener.onStart({ application: app, args: ['robot:12'], channel: { id: 'channel-3' } });

    expect(f.robots.get).not.toHaveBeenCalled();
    expect(f.ari.setChannelVar).toHaveBeenCalledWith('channel-3', 'AI_ROBOT_OUTCOME', 'failed');
    expect(f.ari.continueInDialplan).toHaveBeenCalledWith('channel-3');
  });

  it('ignores channels from another Stasis application', async () => {
    const f = fixture();
    await f.listener.onStart({ application: 'foreign-app', args: ['robot:12'], channel: { id: 'channel-4' } });

    expect(f.ari.answerChannel).not.toHaveBeenCalled();
    expect(f.robots.get).not.toHaveBeenCalled();
  });
});
