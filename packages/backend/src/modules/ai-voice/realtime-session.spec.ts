import { createFakeVoiceModelSession, invocationReplay } from './realtime-session';

describe('RT1 VoiceModelSession', () => {
  it('records audio only after start and refuses a second originate hash mismatch', () => {
    const log: Array<{ op: string; detail?: string }> = [];
    const session = createFakeVoiceModelSession(log);
    return session.start({ sessionId: 's1', model: 'fake' }).then(async () => {
      await session.sendAudio(Buffer.from('hi'));
      await session.close('done');
      expect(log.map(item => item.op)).toEqual(['start', 'audio', 'close']);
      expect(invocationReplay(null, 'abc')).toBe('create');
      expect(invocationReplay('abc', 'abc')).toBe('replay');
      expect(() => invocationReplay('abc', 'def')).toThrow(/invocation_conflict/);
    });
  });
});
