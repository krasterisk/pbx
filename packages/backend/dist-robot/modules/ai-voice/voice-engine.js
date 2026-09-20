"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RUNTIME_POLICY = exports.DomainError = void 0;
exports.emptyVoiceStores = emptyVoiceStores;
exports.draftKey = draftKey;
exports.ensureDraft = ensureDraft;
exports.assertExpectedRevision = assertExpectedRevision;
exports.bumpDraft = bumpDraft;
exports.snapshotDigest = snapshotDigest;
exports.publishVersion = publishVersion;
exports.createDeployment = createDeployment;
exports.enableDeployment = enableDeployment;
exports.issueTicket = issueTicket;
exports.consumeTicket = consumeTicket;
exports.admitSession = admitSession;
exports.drainOnExpiry = drainOnExpiry;
const node_crypto_1 = require("node:crypto");
class DomainError extends Error {
    code;
    status;
    constructor(code, status, message) {
        super(message ? `${code}: ${message}` : code);
        this.code = code;
        this.status = status;
    }
}
exports.DomainError = DomainError;
exports.DEFAULT_RUNTIME_POLICY = Object.freeze({
    prerollMs: 300,
    endpointSilenceMs: 600,
    maxUtteranceMs: 30_000,
    maxCallMs: 10 * 60_000,
    maxTurns: 60,
    maxBufferedAudioMs: 2000,
    ttsPrefetch: 2,
    transferTargetIds: [],
    capture: 'allow',
});
function emptyVoiceStores() {
    return { drafts: new Map(), versions: new Map(), deployments: new Map(), published: new Map() };
}
function draftKey(tenantUid, agentUid) {
    return `${tenantUid}:${agentUid}`;
}
function ensureDraft(stores, agent, now = new Date()) {
    const key = draftKey(agent.tenantUid, agent.uid);
    if (stores.drafts.has(key))
        return;
    stores.drafts.set(key, {
        tenantUid: agent.tenantUid,
        agentUid: agent.uid,
        robotUuid: (0, node_crypto_1.randomUUID)(),
        draftRevision: 1,
        policy: { ...exports.DEFAULT_RUNTIME_POLICY },
    });
    void now;
}
function assertExpectedRevision(stores, agent, expected) {
    ensureDraft(stores, agent);
    if (expected == null || !Number.isInteger(expected)) {
        throw new DomainError('revision_required', 428);
    }
    const draft = stores.drafts.get(draftKey(agent.tenantUid, agent.uid));
    if (draft.draftRevision !== expected)
        throw new DomainError('stale_draft', 409);
}
function bumpDraft(stores, agent, expected, policy) {
    assertExpectedRevision(stores, agent, expected);
    const draft = stores.drafts.get(draftKey(agent.tenantUid, agent.uid));
    draft.policy = { ...draft.policy, ...policy };
    draft.draftRevision += 1;
    return draft.draftRevision;
}
function snapshotDigest(agent, policy) {
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify({
        name: agent.name, uniqueId: agent.uniqueId, mode: agent.mode,
        greeting: agent.greeting, instruction: agent.instruction,
        modelProfileId: agent.modelProfileId, sttProfileId: agent.sttProfileId, ttsProfileId: agent.ttsProfileId,
        policy,
    })).digest('hex');
}
function publishVersion(input) {
    if (input.agent.tenantUid < 0)
        throw new DomainError('tenant_mismatch', 404);
    if (input.agent.mode !== 'cascade')
        throw new DomainError('realtime_unavailable', 409);
    if (!input.agent.enabled || !input.agent.modelProfileId || !input.agent.sttProfileId || !input.agent.ttsProfileId) {
        throw new DomainError('agent_not_ready', 409);
    }
    ensureDraft(input.stores, input.agent);
    const existing = input.stores.published.get(input.operationKey);
    if (existing) {
        const version = input.stores.versions.get(existing);
        if (!version)
            throw new DomainError('publish_conflict', 409);
        return { id: version.id, replay: true };
    }
    const draft = input.stores.drafts.get(draftKey(input.agent.tenantUid, input.agent.uid));
    const id = (0, node_crypto_1.randomUUID)();
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
function createDeployment(input) {
    if (input.kind === 'external_sip') {
        const id = (0, node_crypto_1.randomUUID)();
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
    const id = (0, node_crypto_1.randomUUID)();
    input.stores.deployments.set(id, {
        id, tenantUid: input.tenantUid, agentUid: input.agentUid, kind: input.kind,
        status: 'disabled', revision: 1, activeVersionId: version.id,
    });
    return { id, status: 'disabled' };
}
function enableDeployment(stores, deploymentId, ready) {
    const row = stores.deployments.get(deploymentId);
    if (!row)
        throw new DomainError('deployment_not_found', 404);
    if (row.kind === 'external_sip' && ready)
        throw new DomainError('external_sip_disabled', 409);
    if (ready && !row.activeVersionId)
        throw new DomainError('version_not_found', 409);
    row.status = ready ? 'ready' : 'disabled';
    row.revision += 1;
}
function issueTicket(input) {
    const id = (0, node_crypto_1.randomUUID)();
    const expiresAt = new Date(input.now.getTime() + 30_000);
    const digest = (0, node_crypto_1.createHash)('sha256')
        .update(`${input.secret}:${id}:${input.tenantUid}:${input.nodeId}:${input.channelUniqueid}:${input.deploymentId}`)
        .digest('hex');
    return { id, digest, expiresAt };
}
function consumeTicket(input) {
    if (input.ticket.consumedAt)
        throw new DomainError('ticket_replay', 409);
    if (input.ticket.expiresAt.getTime() <= input.now.getTime())
        throw new DomainError('ticket_expired', 403);
    const expected = (0, node_crypto_1.createHash)('sha256')
        .update(`${input.secret}:${input.ticket.id}:${input.ticket.tenantUid}:${input.ticket.nodeId}:${input.ticket.channelUniqueid}:${input.ticket.deploymentId}`)
        .digest();
    const actual = Buffer.from(input.ticket.digest, 'hex');
    if (actual.length !== expected.length || !(0, node_crypto_1.timingSafeEqual)(actual, expected)) {
        throw new DomainError('spoof_ticket', 403);
    }
    if (input.claimed.nodeId !== input.ticket.nodeId
        || input.claimed.channelUniqueid !== input.ticket.channelUniqueid
        || input.claimed.deploymentId !== input.ticket.deploymentId
        || input.claimed.tenantUid !== input.ticket.tenantUid) {
        throw new DomainError('spoof_ticket', 403);
    }
}
function admitSession(input) {
    const existing = [...input.sessions.values()].find(row => row.ingressKind === input.ingressKind && row.ingressKey === input.ingressKey);
    if (existing)
        return { id: existing.id, replay: true };
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
    const id = (0, node_crypto_1.randomUUID)();
    input.sessions.set(id, {
        id, ingressKind: input.ingressKind, ingressKey: input.ingressKey,
        deploymentId: deployment.id, versionId: deployment.activeVersionId,
    });
    return { id, replay: false };
}
function drainOnExpiry(stores, tenantUid, expired) {
    const drained = [];
    if (!expired)
        return { admissionsStopped: false, drained };
    for (const row of stores.deployments.values()) {
        if (row.tenantUid !== tenantUid)
            continue;
        if (row.status === 'ready') {
            row.status = 'draining';
            row.revision += 1;
            drained.push(row.id);
        }
    }
    return { admissionsStopped: true, drained };
}
//# sourceMappingURL=voice-engine.js.map