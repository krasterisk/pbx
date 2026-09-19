import type { CcAiProvider } from './models/ai-provider.model';

export type ProviderRole = 'model' | 'stt' | 'tts' | 'toolset';
export type AgentReadinessIssueCode =
  | 'missing_provider' | 'disabled_provider' | 'provider_capability_mismatch'
  | 'missing_toolset' | 'invalid_mode';

export interface AgentReadinessIssue {
  code: AgentReadinessIssueCode;
  role: ProviderRole;
  referenceUid: number | null;
}

export interface AgentConfigurationReadiness {
  ready: boolean;
  issues: AgentReadinessIssue[];
}

export interface AgentProviderLinks {
  mode: 'realtime' | 'cascade';
  enabled?: boolean;
  model_profile_id?: number | null;
  stt_profile_id?: number | null;
  tts_profile_id?: number | null;
  toolset_id?: number | null;
}

export type SafeProvider = Pick<CcAiProvider, 'uid' | 'user_uid' | 'enabled' | 'capabilities'>;

/** Pure role/ownership check; it does not inspect endpoints or encrypted keys. */
export function assessAgentReadiness(
  agent: AgentProviderLinks,
  tenantUid: number,
  providers: ReadonlyMap<number, SafeProvider>,
  toolsets: ReadonlySet<number>,
): AgentConfigurationReadiness {
  const issues: AgentReadinessIssue[] = [];
  const inspect = (role: 'model' | 'stt' | 'tts', uid: number | null | undefined, capability: string) => {
    const referenceUid = Number.isSafeInteger(uid) && Number(uid) > 0 ? Number(uid) : null;
    const candidate = referenceUid === null ? undefined : providers.get(referenceUid);
    const provider = candidate?.user_uid === tenantUid ? candidate : undefined;
    if (!provider) {
      issues.push({ code: 'missing_provider', role, referenceUid });
      return;
    }
    if (!provider.enabled) issues.push({ code: 'disabled_provider', role, referenceUid });
    if (!Array.isArray(provider.capabilities) || !provider.capabilities.includes(capability)) {
      issues.push({ code: 'provider_capability_mismatch', role, referenceUid });
    }
  };
  if (agent.mode !== 'realtime' && agent.mode !== 'cascade') {
    issues.push({ code: 'invalid_mode', role: 'model', referenceUid: null });
  } else {
    inspect('model', agent.model_profile_id, agent.mode === 'realtime' ? 'realtime' : 'llm');
    if (agent.mode === 'cascade') {
      inspect('stt', agent.stt_profile_id, 'stt');
      inspect('tts', agent.tts_profile_id, 'tts');
    }
  }
  if (agent.toolset_id != null && agent.toolset_id !== 0 && !toolsets.has(agent.toolset_id)) {
    issues.push({ code: 'missing_toolset', role: 'toolset', referenceUid: agent.toolset_id });
  }
  return { ready: issues.length === 0, issues };
}
