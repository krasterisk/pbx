import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export class DomainError extends Error {
  constructor(readonly code: string, readonly status: number, message?: string) {
    super(message ? `${code}: ${message}` : code);
  }
}

export const DEFAULT_RUNTIME_POLICY = Object.freeze({
  prerollMs: 300,
  endpointSilenceMs: 600,
  maxUtteranceMs: 30_000,
  maxCallMs: 10 * 60_000,
  maxTurns: 60,
  maxBufferedAudioMs: 2000,
  ttsPrefetch: 2,
  transferTargetIds: [] as string[],
  capture: 'allow' as 'allow' | 'deny',
});

export type RuntimePolicy = typeof DEFAULT_RUNTIME_POLICY;

export type AgentSnapshot = {
  uid: number;
  tenantUid: number;
  name: string;
  uniqueId: string;
  mode: 'realtime' | 'cascade';
  greeting: string;
  instruction: string;
  modelProfileId: number | null;
  sttProfileId: number | null;
  ttsProfileId: number | null;
  enabled: boolean;
};

export type VoiceStores = {
  drafts: Map<string, {
    tenantUid: number; agentUid: number; robotUuid: string; draftRevision: number; policy: RuntimePolicy;
  }>;
  versions: Map<string, {
    id: string; tenantUid: number; agentUid: number; versionNo: number; digest: string; config: string; mode: string;
  }>;
  deployments: Map<string, {
    id: string; tenantUid: number; agentUid: number; kind: 'internal' | 'browser_test' | 'external_sip';
    status: 'disabled' | 'ready' | 'draining' | 'stopped'; revision: number; activeVersionId: string | null;
  }>;
  published: Map<string, string>;
};

export function emptyVoiceStores(): VoiceStores {
  return { drafts: new Map(), versions: new Map(), deployments: new Map(), published: new Map() };
}

export function draftKey(tenantUid: number, agentUid: number): string {
  return `${tenantUid}:${agentUid}`;
}

export function ensureDraft(stores: VoiceStores, agent: AgentSnapshot, now = new Date()): void {
  const key = draftKey(agent.tenantUid, agent.uid);
  if (stores.drafts.has(key)) return;
  stores.drafts.set(key, {
    tenantUid: agent.tenantUid,
    agentUid: agent.uid,
    robotUuid: randomUUID(),
    draftRevision: 1,
    policy: { ...DEFAULT_RUNTIME_POLICY },
  });
  void now;
}

export function assertExpectedRevision(stores: VoiceStores, agent: AgentSnapshot, expected?: number): void {
  ensureDraft(stores, agent);
  if (expected == null || !Number.isInteger(expected)) {
    throw new DomainError('revision_required', 428);
  }
  const draft = stores.drafts.get(draftKey(agent.tenantUid, agent.uid))!;
  if (draft.draftRevision !== expected) throw new DomainError('stale_draft', 409);
}

export function bumpDraft(stores: VoiceStores, agent: AgentSnapshot, expected: number, policy?: Partial<RuntimePolicy>): number {
  assertExpectedRevision(stores, agent, expected);
  const draft = stores.drafts.get(draftKey(agent.tenantUid, agent.uid))!;
  draft.policy = { ...draft.policy, ...policy };
  draft.draftRevision += 1;
  return draft.draftRevision;
}

export function snapshotDigest(agent: AgentSnapshot, policy: RuntimePolicy): string {
  return createHash('sha256').update(JSON.stringify({
    name: agent.name, uniqueId: agent.uniqueId, mode: agent.mode,
    greeting: agent.greeting, instruction: agent.instruction,
    modelProfileId: agent.modelProfileId, sttProfileId: agent.sttProfileId, ttsProfileId: agent.ttsProfileId,
    policy,
  })).digest('hex');
}

export function publishVersion(input: {
  stores: VoiceStores;
  agent: AgentSnapshot;
  userId: number;
  operationKey: string;
  llmRevisionId: string;
}): { id: string; replay: boolean } {
  if (input.agent.tenantUid < 0) throw new DomainError('tenant_mismatch', 404);
  if (input.agent.mode !== 'cascade') throw new DomainError('realtime_unavailable', 409);
  if (!input.agent.enabled || !input.agent.modelProfileId || !input.agent.sttProfileId || !input.agent.ttsProfileId) {
    throw new DomainError('agent_not_ready', 409);
  }
  ensureDraft(input.stores, input.agent);
  const existing = input.stores.published.get(input.operationKey);
  if (existing) {
    const version = input.stores.versions.get(existing);
    if (!version) throw new DomainError('publish_conflict', 409);
    return { id: version.id, replay: true };
  }
  const draft = input.stores.drafts.get(draftKey(input.agent.tenantUid, input.agent.uid))!;
  const id = randomUUID();
  const versionNo = [...input.stores.versions.values()].filter(row => row.agentUid === input.agent.uid).length + 1;
  input.stores.versions.set(id, {
    id, tenantUid: input.agent.tenantUid, agentUid: input.agent.uid, versionNo,
    digest: snapshotDigest(input.agent, draft.policy),
    config: JSON.stringify({ agent: input.agent, policy: draft.policy }),
    mode: input.agent.mode,
  });
  input.stores.published.set(input.operationKey, id);
  return { id, replay: false };
}

export function createDeployment(input: {
  stores: VoiceStores;
  tenantUid: number;
  agentUid: number;
  kind: 'internal' | 'browser_test' | 'external_sip';
  versionId?: string;
}): { id: string; status: string } {
  if (input.kind === 'external_sip') {
    const id = randomUUID();
    input.stores.deployments.set(id, {
      id, tenantUid: input.tenantUid, agentUid: input.agentUid, kind: input.kind,
      status: 'disabled', revision: 1, activeVersionId: null,
    });
    return { id, status: 'disabled' };
  }
  const version = input.versionId ? input.stores.versions.get(input.versionId) : undefined;
  if (!version || version.tenantUid !== input.tenantUid || version.agentUid !== input.agentUid) {
    throw new DomainError('version_not_found', 404);
  }
  const id = randomUUID();
  input.stores.deployments.set(id, {
    id, tenantUid: input.tenantUid, agentUid: input.agentUid, kind: input.kind,
    status: 'disabled', revision: 1, activeVersionId: version.id,
  });
  return { id, status: 'disabled' };
}

export function enableDeployment(stores: VoiceStores, deploymentId: string, ready: boolean): void {
  const row = stores.deployments.get(deploymentId);
  if (!row) throw new DomainError('deployment_not_found', 404);
  if (row.kind === 'external_sip' && ready) throw new DomainError('external_sip_disabled', 409);
  if (ready && !row.activeVersionId) throw new DomainError('version_not_found', 409);
  row.status = ready ? 'ready' : 'disabled';
  row.revision += 1;
}

export function issueTicket(input: {
  secret: string;
  tenantUid: number;
  nodeId: string;
  channelUniqueid: string;
  deploymentId: string;
  now: Date;
}): { id: string; digest: string; expiresAt: Date } {
  const id = randomUUID();
  const expiresAt = new Date(input.now.getTime() + 30_000);
  const digest = createHash('sha256')
    .update(`${input.secret}:${id}:${input.tenantUid}:${input.nodeId}:${input.channelUniqueid}:${input.deploymentId}`)
    .digest('hex');
  return { id, digest, expiresAt };
}

export function consumeTicket(input: {
  secret: string;
  ticket: { id: string; digest: string; tenantUid: number; nodeId: string; channelUniqueid: string; deploymentId: string; expiresAt: Date; consumedAt: Date | null };
  claimed: { nodeId: string; channelUniqueid: string; deploymentId: string; tenantUid: number };
  now: Date;
}): void {
  if (input.ticket.consumedAt) throw new DomainError('ticket_replay', 409);
  if (input.ticket.expiresAt.getTime() <= input.now.getTime()) throw new DomainError('ticket_expired', 403);
  const expected = createHash('sha256')
    .update(`${input.secret}:${input.ticket.id}:${input.ticket.tenantUid}:${input.ticket.nodeId}:${input.ticket.channelUniqueid}:${input.ticket.deploymentId}`)
    .digest();
  const actual = Buffer.from(input.ticket.digest, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new DomainError('spoof_ticket', 403);
  }
  if (input.claimed.nodeId !== input.ticket.nodeId
    || input.claimed.channelUniqueid !== input.ticket.channelUniqueid
    || input.claimed.deploymentId !== input.ticket.deploymentId
    || input.claimed.tenantUid !== input.ticket.tenantUid) {
    throw new DomainError('spoof_ticket', 403);
  }
}

export function admitSession(input: {
  stores: VoiceStores;
  sessions: Map<string, { id: string; ingressKind: string; ingressKey: string; deploymentId: string; versionId: string }>;
  deploymentId: string;
  ingressKind: 'native' | 'browser_test' | 'autodial';
  ingressKey: string;
}): { id: string; replay: boolean } {
  const existing = [...input.sessions.values()].find(row =>
    row.ingressKind === input.ingressKind && row.ingressKey === input.ingressKey);
  if (existing) return { id: existing.id, replay: true };
  const deployment = input.stores.deployments.get(input.deploymentId);
  if (!deployment || !deployment.activeVersionId) {
    throw new DomainError('deployment_not_ready', 409);
  }
  if (deployment.status === 'draining' || deployment.status === 'stopped') {
    throw new DomainError('admissions_stopped', 409);
  }
  if (deployment.status !== 'ready') {
    throw new DomainError('deployment_not_ready', 409);
  }
  const id = randomUUID();
  input.sessions.set(id, {
    id, ingressKind: input.ingressKind, ingressKey: input.ingressKey,
    deploymentId: deployment.id, versionId: deployment.activeVersionId,
  });
  return { id, replay: false };
}

export function drainOnExpiry(
  stores: VoiceStores,
  tenantUid: number,
  expired: boolean,
): { admissionsStopped: boolean; drained: string[] } {
  const drained: string[] = [];
  if (!expired) return { admissionsStopped: false, drained };
  for (const row of stores.deployments.values()) {
    if (row.tenantUid !== tenantUid) continue;
    if (row.status === 'ready') {
      row.status = 'draining';
      row.revision += 1;
      drained.push(row.id);
    }
  }
  return { admissionsStopped: true, drained };
}
