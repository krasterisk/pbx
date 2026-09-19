import { assessAgentReadiness, type SafeProvider } from './ai-agent-readiness';

const row = (uid: number, userUid: number, capabilities: string[], enabled = true) =>
  ({ uid, user_uid: userUid, capabilities, enabled } as SafeProvider);

describe('agent configuration readiness', () => {
  it('requires realtime capability for realtime, not merely llm', () => {
    const agent = { mode: 'realtime' as const, model_profile_id: 1 };
    expect(assessAgentReadiness(agent, 42, new Map([[1, row(1, 42, ['llm'])]]), new Set()))
      .toMatchObject({ ready: false, issues: [
        { code: 'provider_capability_mismatch', role: 'model', referenceUid: 1 },
      ] });
    expect(assessAgentReadiness(agent, 42, new Map([[1, row(1, 42, ['realtime'])]]), new Set()))
      .toEqual({ ready: true, issues: [] });
  });

  it('checks all three cascade roles, disabled status and exact tenant ownership', () => {
    const agent = { mode: 'cascade' as const, model_profile_id: 1, stt_profile_id: 2, tts_profile_id: 3 };
    const providers = new Map([
      [1, row(1, 42, ['llm'])],
      [2, row(2, 42, ['stt'], false)],
      [3, row(3, 0, ['tts'])],
    ]);
    expect(assessAgentReadiness(agent, 42, providers, new Set())).toEqual({
      ready: false,
      issues: [
        { code: 'disabled_provider', role: 'stt', referenceUid: 2 },
        { code: 'missing_provider', role: 'tts', referenceUid: 3 },
      ],
    });
    providers.set(2, row(2, 42, ['stt']));
    providers.set(3, row(3, 42, ['tts']));
    expect(assessAgentReadiness(agent, 42, providers, new Set())).toEqual({ ready: true, issues: [] });
  });

  it('treats tenant zero as a real owner and does not expose provider configuration', () => {
    const agent = { mode: 'realtime' as const, model_profile_id: 4, toolset_id: 9 };
    const providers = new Map([[4, row(4, 0, ['realtime'])]]);
    expect(assessAgentReadiness(agent, 0, providers, new Set([9])))
      .toEqual({ ready: true, issues: [] });
    expect(assessAgentReadiness(agent, 2, providers, new Set())).toMatchObject({
      ready: false, issues: [
        { code: 'missing_provider', role: 'model', referenceUid: 4 },
        { code: 'missing_toolset', role: 'toolset', referenceUid: 9 },
      ],
    });
  });
});
