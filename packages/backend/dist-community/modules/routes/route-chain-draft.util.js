"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTE_ACTION_TYPES = void 0;
exports.validateRouteChainDraft = validateRouteChainDraft;
exports.ROUTE_ACTION_TYPES = [
    'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
    'toivr', 'toroute', 'playback',
    'notify', 'callerid',
    'voicemail', 'text2speech', 'voicerobot',
    'webhook', 'confbridge', 'cmd',
    'label', 'goto', 'schedule',
    'http_request', 'collect_input',
    'hangup', 'directory_lookup',
    'callback',
];
const ACTION_TYPE_SET = new Set(exports.ROUTE_ACTION_TYPES);
function validateRouteChainDraft(steps, refs) {
    if (!Array.isArray(steps) || steps.length === 0) {
        return { ok: false, stepIndex: 0, reason: 'actions must be a non-empty typed chain' };
    }
    const chain = [];
    for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        const checked = validateStep(step, i, refs);
        if (!checked.ok)
            return checked;
        chain.push(checked.action);
    }
    return { ok: true, chain };
}
function validateStep(step, stepIndex, refs) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
        return { ok: false, stepIndex, reason: 'step must be a typed action object' };
    }
    const rec = step;
    if (rec.app != null && rec.type == null) {
        return {
            ok: false,
            stepIndex,
            reason: 'raw app/appdata is not a typed action; supply type and params',
        };
    }
    const type = String(rec.type ?? '');
    if (!type || !ACTION_TYPE_SET.has(type)) {
        return {
            ok: false,
            stepIndex,
            reason: `unknown action kind "${type || '(missing type)'}"`,
        };
    }
    if (!rec.params || typeof rec.params !== 'object' || Array.isArray(rec.params)) {
        return { ok: false, stepIndex, reason: 'params must be an object' };
    }
    const params = rec.params;
    const missing = missingRequiredParam(type, params);
    if (missing) {
        return { ok: false, stepIndex, reason: `missing required parameter ${missing}` };
    }
    const entity = unresolvedEntity(type, params, refs);
    if (entity) {
        return { ok: false, stepIndex, reason: entity };
    }
    const condition = (rec.condition && typeof rec.condition === 'object' && !Array.isArray(rec.condition))
        ? rec.condition
        : {};
    const id = typeof rec.id === 'string' && rec.id ? rec.id : `step-${stepIndex + 1}`;
    return {
        ok: true,
        action: {
            id,
            type,
            params,
            condition,
        },
    };
}
function missingRequiredParam(type, params) {
    switch (type) {
        case 'toqueue':
            return valueSourceOrString(params.target) || stringOf(params.queue) ? null : 'target';
        case 'toexten':
            return valueSourceOrString(params.target) || stringOf(params.exten) ? null : 'target';
        case 'totrunk':
            return stringOf(params.trunk) || (Array.isArray(params.trunks) && params.trunks.length > 0)
                ? null
                : 'trunk';
        case 'toivr':
            return params.ivr_uid != null && String(params.ivr_uid) !== '' ? null : 'ivr_uid';
        case 'toroute':
            return stringOf(params.context) ? null : 'context';
        case 'togroup':
            return valueSourceOrString(params.target) || stringOf(params.group) ? null : 'target';
        case 'tolist':
            return stringOf(params.numbers) ? null : 'numbers';
        case 'playback':
            return stringOf(params.file) || hasFiles(params.files) ? null : 'file';
        case 'voicemail':
            return valueSourceOrString(params.target) || stringOf(params.exten) ? null : 'target';
        case 'text2speech':
            return stringOf(params.text) ? null : 'text';
        case 'voicerobot':
            return params.robot_uid != null && String(params.robot_uid) !== '' ? null : 'robot_uid';
        case 'webhook':
        case 'http_request':
            return stringOf(params.url) ? null : 'url';
        case 'confbridge':
            return valueSourceOrString(params.room) ? null : 'room';
        case 'cmd':
            return stringOf(params.command) ? null : 'command';
        case 'label':
        case 'goto':
            return stringOf(params.label_name) ? null : 'label_name';
        case 'collect_input':
            return stringOf(params.variableName) ? null : 'variableName';
        case 'directory_lookup':
            return params.directoryUid != null && String(params.directoryUid) !== '' ? null : 'directoryUid';
        case 'hangup':
        case 'notify':
        case 'callerid':
        case 'schedule':
        case 'callback':
            return null;
        default:
            return null;
    }
}
function unresolvedEntity(type, params, refs) {
    if (type === 'toqueue') {
        const name = valueSourceOrString(params.target) || stringOf(params.queue);
        if (name && !refs.queues.some((row) => row.name === name || String(row.exten) === name)) {
            return `queue "${name}" does not exist for this tenant`;
        }
    }
    if (type === 'toexten') {
        const ext = valueSourceOrString(params.target) || stringOf(params.exten);
        if (ext
            && !refs.extensions.some((row) => String(row.extension) === ext || String(row.sipUsername) === ext)) {
            return `extension "${ext}" does not exist for this tenant`;
        }
    }
    if (type === 'totrunk') {
        const trunk = stringOf(params.trunk);
        if (trunk && !refs.trunks.some((row) => row.id === trunk || row.name === trunk)) {
            return `trunk "${trunk}" does not exist for this tenant`;
        }
        if (Array.isArray(params.trunks)) {
            for (const item of params.trunks) {
                const rec = (item && typeof item === 'object' ? item : {});
                const id = stringOf(rec.trunkId) || stringOf(rec.trunk) || stringOf(rec.id);
                if (id && !refs.trunks.some((row) => row.id === id || row.name === id)) {
                    return `trunk "${id}" does not exist for this tenant`;
                }
            }
        }
    }
    if (type === 'toivr') {
        const ivr = String(params.ivr_uid ?? '');
        if (ivr && !refs.ivrs.some((row) => String(row.uid) === ivr || row.name === ivr)) {
            return `ivr "${ivr}" does not exist for this tenant`;
        }
    }
    if (type === 'toroute') {
        const context = stringOf(params.context);
        if (context
            && !refs.contexts.some((row) => String(row.uid) === context || row.name === context)
            && !refs.routes.some((row) => String(row.uid) === context || row.name === context)) {
            return `route context "${context}" does not exist for this tenant`;
        }
    }
    if (type === 'directory_lookup') {
        const dir = String(params.directoryUid ?? '');
        if (dir && !refs.directories.some((row) => String(row.uid) === dir)) {
            return `directory "${dir}" does not exist for this tenant`;
        }
    }
    if (type === 'togroup') {
        const group = valueSourceOrString(params.target) || stringOf(params.group);
        const groups = refs.groups ?? [];
        if (group
            && !groups.some((row) => String(row.uid) === group
                || String(row.exten) === group
                || String(row.name) === group)) {
            return `call group "${group}" does not exist for this tenant`;
        }
    }
    return null;
}
function valueSourceOrString(value) {
    if (typeof value === 'string' && value)
        return value;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const rec = value;
        if (rec.value != null && String(rec.value))
            return String(rec.value);
    }
    return null;
}
function stringOf(value) {
    return typeof value === 'string' && value ? value : null;
}
function hasFiles(value) {
    if (typeof value === 'string')
        return value.length > 0;
    return Array.isArray(value) && value.some((item) => typeof item === 'string' && item);
}
//# sourceMappingURL=route-chain-draft.util.js.map