"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordingBusinessKey = exports.DomainError = void 0;
exports.emptyAnalyticsStores = emptyAnalyticsStores;
exports.configDigest = configDigest;
exports.createProject = createProject;
exports.updateDraft = updateDraft;
exports.publishProject = publishProject;
exports.hashBusinessKey = hashBusinessKey;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@krasterisk/shared");
Object.defineProperty(exports, "recordingBusinessKey", { enumerable: true, get: function () { return shared_1.recordingBusinessKey; } });
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
function emptyAnalyticsStores() {
    return { projects: new Map(), versions: new Map(), members: new Map() };
}
function configDigest(config) {
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(config)).digest('hex');
}
function createProject(input) {
    if (input.tenantUid <= 0)
        throw new DomainError('tenant_mismatch', 404);
    const project = {
        id: (0, node_crypto_1.randomUUID)(),
        tenantUid: input.tenantUid,
        name: input.name,
        status: 'draft',
        draftRevision: 1,
        draftConfig: (0, shared_1.defaultSaProjectConfig)(),
        activeVersionId: null,
        createdBy: input.userId,
    };
    input.stores.projects.set(project.id, project);
    input.stores.members.set(`${project.id}:${input.userId}`, {
        tenantUid: input.tenantUid, projectId: project.id, userId: input.userId,
        role: 'owner', canAudio: true, canTranscript: true,
    });
    return project;
}
function updateDraft(input) {
    const project = input.stores.projects.get(input.projectId);
    if (!project || project.tenantUid !== input.tenantUid)
        throw new DomainError('resource_not_found', 404);
    if (project.status === 'archived')
        throw new DomainError('project_archived', 409);
    if (project.draftRevision !== input.expectedRevision)
        throw new DomainError('stale_draft', 409);
    project.draftConfig = input.config;
    project.draftRevision += 1;
    return project;
}
function publishProject(input) {
    const replay = input.published?.get(`${input.tenantUid}:${input.operationKey}`);
    if (replay) {
        const existing = input.stores.versions.get(replay);
        if (existing)
            return existing;
    }
    const project = input.stores.projects.get(input.projectId);
    if (!project || project.tenantUid !== input.tenantUid)
        throw new DomainError('resource_not_found', 404);
    const member = input.stores.members.get(`${input.projectId}:${input.userId}`);
    if (!member || member.role !== 'owner' || member.tenantUid !== input.tenantUid) {
        throw new DomainError('resource_permission_denied', 403);
    }
    const versionNo = [...input.stores.versions.values()]
        .filter(row => row.projectId === project.id).length + 1;
    const version = {
        id: (0, node_crypto_1.randomUUID)(),
        tenantUid: project.tenantUid,
        projectId: project.id,
        versionNo,
        configDigest: configDigest(project.draftConfig),
        config: { ...project.draftConfig },
    };
    input.stores.versions.set(version.id, version);
    project.activeVersionId = version.id;
    project.status = 'active';
    input.published?.set(`${input.tenantUid}:${input.operationKey}`, version.id);
    return version;
}
function hashBusinessKey(raw) {
    return (0, node_crypto_1.createHash)('sha256').update(raw, 'utf8').digest('hex');
}
//# sourceMappingURL=project-engine.js.map