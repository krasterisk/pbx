import { processingAdmission, type SkuStores } from '../ai-usage/sku-catalog';
import { evaluateSipProfile } from './realtime-session';
import {
  admitSession, createDeployment, drainOnExpiry, emptyVoiceStores, enableDeployment,
  publishVersion, type AgentSnapshot, type VoiceStores,
} from './voice-engine';

export const ROBOTS_ONBOARDING_STEPS = [
  'provider', 'prompt', 'test', 'sip_profile', 'publish',
] as const;
export type RobotsOnboardingStep = typeof ROBOTS_ONBOARDING_STEPS[number];

export type RobotsOnboardingStores = {
  sku: SkuStores;
  voice: VoiceStores;
  providers: Map<number, { providerId: string }>;
  prompts: Map<number, { instruction: string }>;
  sip: Map<number, ReturnType<typeof evaluateSipProfile>>;
  sessions: Map<string, {
    id: string; ingressKind: string; ingressKey: string; deploymentId: string; versionId: string;
  }>;
  testDeployments: Map<number, string>;
};

export function emptyRobotsOnboarding(sku: SkuStores): RobotsOnboardingStores {
  return {
    sku,
    voice: emptyVoiceStores(),
    providers: new Map(),
    prompts: new Map(),
    sip: new Map(),
    sessions: new Map(),
    testDeployments: new Map(),
  };
}

function fail(code: string): never {
  throw Object.assign(new Error(code), { code });
}

export function robotsOnboardingRequiresAnalytics(): false {
  return false;
}

export function defaultRobotAgent(tenantUid: number): AgentSnapshot {
  return {
    uid: tenantUid * 10, tenantUid, name: 'Pilot', uniqueId: `pilot-${tenantUid}`,
    mode: 'cascade', greeting: 'здравствуйте', instruction: 'помогайте',
    modelProfileId: 1, sttProfileId: 2, ttsProfileId: 3, enabled: true,
  };
}

export function onboardRobots(input: {
  stores: RobotsOnboardingStores;
  tenantUid: number;
  now: Date;
  step: RobotsOnboardingStep;
  providerId?: string;
  instruction?: string;
  transport?: string;
  nativePbx?: boolean;
  i4Evidence?: boolean;
  agent?: AgentSnapshot;
}): { step: RobotsOnboardingStep; next: RobotsOnboardingStep | 'done'; id?: string; reason?: string | null } {
  const admission = processingAdmission(input.stores.sku, {
    tenantUid: input.tenantUid, product: 'ai_voice_robots', now: input.now,
  });
  if (!admission.allowed) fail(admission.reason ?? 'not_entitled');
  if (input.step === 'provider') {
    input.stores.providers.set(input.tenantUid, { providerId: input.providerId ?? 'llm-1' });
    return { step: 'provider', next: 'prompt', id: input.providerId ?? 'llm-1' };
  }
  if (!input.stores.providers.get(input.tenantUid)) fail('provider_missing');
  if (input.step === 'prompt') {
    input.stores.prompts.set(input.tenantUid, { instruction: input.instruction ?? 'помогайте' });
    return { step: 'prompt', next: 'test' };
  }
  if (!input.stores.prompts.get(input.tenantUid)) fail('prompt_missing');
  const agent = input.agent ?? defaultRobotAgent(input.tenantUid);
  if (input.step === 'test') {
    const published = publishVersion({
      stores: input.stores.voice, agent, userId: input.tenantUid,
      operationKey: `test-${input.tenantUid}`, llmRevisionId: 'llm',
    });
    const deployment = createDeployment({
      stores: input.stores.voice, tenantUid: input.tenantUid, agentUid: agent.uid,
      kind: 'browser_test', versionId: published.id,
    });
    enableDeployment(input.stores.voice, deployment.id, true);
    input.stores.testDeployments.set(input.tenantUid, deployment.id);
    return { step: 'test', next: 'sip_profile', id: deployment.id };
  }
  if (input.step === 'sip_profile') {
    const profile = evaluateSipProfile({
      transport: input.transport ?? 'udp',
      nativePbx: input.nativePbx === true,
      i4Evidence: input.i4Evidence === true,
    });
    input.stores.sip.set(input.tenantUid, profile);
    return {
      step: 'sip_profile',
      next: profile.status === 'disabled' ? 'sip_profile' : 'publish',
      reason: profile.reason,
    };
  }
  const sip = input.stores.sip.get(input.tenantUid);
  if (!sip || sip.status === 'disabled') fail(sip?.reason ?? 'sip_profile_missing');
  const published = publishVersion({
    stores: input.stores.voice, agent, userId: input.tenantUid,
    operationKey: `pub-${input.tenantUid}`, llmRevisionId: 'llm',
  });
  return { step: 'publish', next: 'done', id: published.id };
}

export function expireAndDrain(input: {
  stores: RobotsOnboardingStores;
  tenantUid: number;
  now: Date;
}): { admissionsStopped: boolean; drained: string[] } {
  const admission = processingAdmission(input.stores.sku, {
    tenantUid: input.tenantUid, product: 'ai_voice_robots', now: input.now,
  });
  const expired = !admission.allowed && admission.reason === 'entitlement_expired';
  return drainOnExpiry(input.stores.voice, input.tenantUid, expired);
}

export function tryAdmitAfterDrain(input: {
  stores: RobotsOnboardingStores;
  tenantUid: number;
  ingressKey: string;
}): never | { id: string } {
  const deploymentId = input.stores.testDeployments.get(input.tenantUid);
  if (!deploymentId) fail('test_deployment_missing');
  return admitSession({
    stores: input.stores.voice,
    sessions: input.stores.sessions,
    deploymentId,
    ingressKind: 'browser_test',
    ingressKey: input.ingressKey,
  });
}
