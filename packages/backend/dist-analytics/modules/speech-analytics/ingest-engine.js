"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyIngestStores = emptyIngestStores;
exports.claimRecording = claimRecording;
exports.admitInitialRun = admitInitialRun;
exports.metadataAllowlist = metadataAllowlist;
exports.uploadChecksum = uploadChecksum;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@krasterisk/shared");
const project_engine_1 = require("./project-engine");
function emptyIngestStores(base) {
    return {
        projects: base?.projects ?? new Map(),
        versions: base?.versions ?? new Map(),
        members: base?.members ?? new Map(),
        recordings: new Map(),
        runs: new Map(),
        assets: new Map(),
    };
}
function claimRecording(input) {
    if (input.project.tenantUid !== input.tenantUid || input.project.status === 'archived') {
        throw new project_engine_1.DomainError('project_archived', 409);
    }
    if (!input.project.activeVersionId)
        throw new project_engine_1.DomainError('project_not_published', 409);
    const asset = input.stores.assets.get(input.assetId);
    if (!asset || asset.tenantUid !== input.tenantUid)
        throw new project_engine_1.DomainError('foreign_asset', 404);
    if (asset.state !== 'ready')
        throw new project_engine_1.DomainError('asset_not_ready', 409);
    const externalCallId = input.externalCallId;
    if (Buffer.byteLength(externalCallId, 'utf8') < 1 || Buffer.byteLength(externalCallId, 'utf8') > 128) {
        throw new project_engine_1.DomainError('metadata_invalid', 422);
    }
    const sourcePart = input.sourcePart || 'main';
    const raw = (0, shared_1.recordingBusinessKey)({
        tenantUid: input.tenantUid, principalId: input.principalId, projectId: input.project.id,
        externalCallId, sourcePart,
    });
    const businessKeyHash = (0, project_engine_1.hashBusinessKey)(raw);
    const existing = [...input.stores.recordings.values()].find(row => row.tenantUid === input.tenantUid && row.projectId === input.project.id
        && row.principalId === input.principalId && row.businessKeyHash === businessKeyHash);
    if (existing) {
        if (existing.contentDigest === asset.sha256)
            return existing;
        throw new project_engine_1.DomainError('recording_conflict', 409);
    }
    const recording = {
        id: (0, node_crypto_1.randomUUID)(),
        tenantUid: input.tenantUid,
        projectId: input.project.id,
        principalId: input.principalId,
        externalCallId,
        sourcePart,
        businessKeyHash,
        assetId: asset.id,
        contentDigest: asset.sha256,
        metadata: JSON.stringify(input.metadata),
    };
    input.stores.recordings.set(recording.id, recording);
    return recording;
}
function admitInitialRun(input) {
    const existing = [...input.stores.runs.values()].find(row => row.recordingId === input.recording.id);
    if (existing)
        return existing;
    const run = {
        id: (0, node_crypto_1.randomUUID)(),
        tenantUid: input.recording.tenantUid,
        recordingId: input.recording.id,
        projectVersionId: input.projectVersionId,
        jobId: input.jobId,
        state: 'queued',
    };
    input.stores.runs.set(run.id, run);
    return run;
}
function metadataAllowlist(input) {
    const allowed = ['occurredAt', 'timezone', 'direction', 'participants', 'labels'];
    const out = {};
    for (const key of allowed) {
        if (key in input)
            out[key] = input[key];
    }
    if (JSON.stringify(out).length > 4096)
        throw new project_engine_1.DomainError('metadata_invalid', 422);
    return out;
}
function uploadChecksum(body) {
    return (0, node_crypto_1.createHash)('sha256').update(body).digest('hex');
}
//# sourceMappingURL=ingest-engine.js.map