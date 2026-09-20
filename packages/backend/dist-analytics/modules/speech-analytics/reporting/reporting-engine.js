"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RANKING_MIN_SCORED = exports.BULK_LIMIT = exports.SNAPSHOT_LIMIT = void 0;
exports.validateFilterSpec = validateFilterSpec;
exports.filterDigest = filterDigest;
exports.signCursor = signCursor;
exports.parseCursor = parseCursor;
exports.neutralizeCsvCell = neutralizeCsvCell;
exports.dashboardRow = dashboardRow;
exports.scheduleSlot = scheduleSlot;
exports.reserveBudget = reserveBudget;
exports.assertSnapshotSize = assertSnapshotSize;
exports.assertBulkSize = assertBulkSize;
exports.newId = newId;
const node_crypto_1 = require("node:crypto");
const project_engine_1 = require("../project-engine");
exports.SNAPSHOT_LIMIT = 50_000;
exports.BULK_LIMIT = 1000;
exports.RANKING_MIN_SCORED = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_TZ = /^[A-Za-z]+(?:[_/-][A-Za-z0-9]+)+$/;
function validateFilterSpec(input, allowedProjects) {
    if (!input.projectIds.length)
        throw new project_engine_1.DomainError('filter_invalid', 400, 'projectIds');
    if (input.projectIds.some(id => !UUID.test(id) || !allowedProjects.has(id))) {
        throw new project_engine_1.DomainError('foreign_project', 403);
    }
    if (input.projectVersions?.some(id => !UUID.test(id)))
        throw new project_engine_1.DomainError('filter_invalid', 400, 'projectVersions');
    const from = Date.parse(input.from);
    const to = Date.parse(input.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from)
        throw new project_engine_1.DomainError('filter_invalid', 400, 'range');
    const days = (to - from) / 86400000;
    if (days > 366)
        throw new project_engine_1.DomainError('range_too_wide', 400);
    if (!ALLOWED_TZ.test(input.timezone))
        throw new project_engine_1.DomainError('filter_invalid', 400, 'timezone');
    if (input.runSelector !== 'latest_completed' && input.runSelector !== 'explicit') {
        throw new project_engine_1.DomainError('filter_invalid', 400, 'runSelector');
    }
    if (input.view !== 'ai' && input.view !== 'reviewed')
        throw new project_engine_1.DomainError('filter_invalid', 400, 'view');
    return input;
}
function filterDigest(spec) {
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(spec)).digest('hex');
}
function signCursor(secret, digest, sortKey) {
    const payload = `${digest}:${sortKey}`;
    const mac = (0, node_crypto_1.createHmac)('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}:${mac}`).toString('base64url');
}
function parseCursor(secret, cursor, expectedDigest) {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [digest, sortKey, mac] = raw.split(':');
    if (!digest || !sortKey || !mac)
        throw new project_engine_1.DomainError('cursor_invalid', 400);
    const expected = (0, node_crypto_1.createHmac)('sha256', secret).update(`${digest}:${sortKey}`).digest('hex');
    if (digest !== expectedDigest || mac !== expected)
        throw new project_engine_1.DomainError('cursor_stale', 400);
    return sortKey;
}
function neutralizeCsvCell(value) {
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
function dashboardRow(input) {
    return {
        ...input,
        calculatedAt: new Date(0).toISOString(),
        ranking: input.scored >= exports.RANKING_MIN_SCORED ? 'ok' : 'insufficient_sample',
    };
}
function scheduleSlot(localDate, revision) {
    return `${localDate}@${revision}`;
}
function reserveBudget(cap, reserved, units, pauseOnExceed) {
    if (units < 1)
        throw new project_engine_1.DomainError('budget_invalid', 400);
    if (reserved + units > cap) {
        throw new project_engine_1.DomainError(pauseOnExceed ? 'budget_paused' : 'budget_exceeded', 409);
    }
    return reserved + units;
}
function assertSnapshotSize(count) {
    if (count > exports.SNAPSHOT_LIMIT)
        throw new project_engine_1.DomainError('snapshot_too_large', 400, 'narrow the range');
}
function assertBulkSize(count) {
    if (count < 1 || count > exports.BULK_LIMIT)
        throw new project_engine_1.DomainError('bulk_limit', 400);
}
function newId() {
    return (0, node_crypto_1.randomUUID)();
}
//# sourceMappingURL=reporting-engine.js.map