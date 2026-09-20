"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VOICEMAIL_DEFAULT_MAX_DURATION = exports.UNMAPPED_HARD_REMOVE = exports.USE_EXTEN_SENTINEL = void 0;
exports.migrateVoicemailParams = migrateVoicemailParams;
exports.migrateAction = migrateAction;
exports.migrateActionChain = migrateActionChain;
const shared_1 = require("@krasterisk/shared");
/**
 * Pure Phase-12 dialplan action rewrite (D-12 / D-20 / D-28 / D-51 / D-29).
 * No Sequelize, no I/O — the standalone script walks rows and calls this.
 */
exports.USE_EXTEN_SENTINEL = '__USE_EXTEN__';
/**
 * `sendmail` / `sendmailpeer` / `telegram` are here because notify now routes
 * through a notification integration: there is no integration uid to infer from
 * a bare address, so folding them would produce rows that fail validation.
 */
exports.UNMAPPED_HARD_REMOVE = new Set([
    'tofax', 'asr', 'keywords',
    'sendmail', 'sendmailpeer', 'telegram',
]);
const KNOWN_TYPES = new Set([
    'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
    'toivr', 'toroute', 'playprompt', 'playback', 'background',
    'setclid_custom', 'setclid_list',
    'notify', 'callerid',
    'voicemail', 'text2speech', 'voicerobot',
    'webhook', 'confbridge', 'cmd',
    'label', 'busy', 'hangup', 'congestion',
    'goto', 'branch', 'schedule', 'http_request', 'collect_input',
]);
const ADDRESS_STRING_FIELDS = {
    toqueue: { from: 'queue', to: 'target' },
    toexten: { from: 'exten', to: 'target', useExtenField: 'useExten' },
    togroup: { from: 'group', to: 'target' },
    voicemail: { from: 'exten', to: 'target' },
    totrunk: { from: 'dest', to: 'dest' },
    toroute: { from: 'context', to: 'context' },
    confbridge: { from: 'room', to: 'room' },
};
/** D-54 default Record() max seconds when a stored voicemail step has no duration. */
exports.VOICEMAIL_DEFAULT_MAX_DURATION = 120;
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isValueSource(value) {
    return isPlainObject(value) && typeof value.source === 'string';
}
function isRoutePatternToken(value) {
    return value === exports.USE_EXTEN_SENTINEL || value === '' || value === '${EXTEN}';
}
function toValueSource(raw, useExten) {
    if (useExten)
        return { source: 'route_pattern' };
    if (typeof raw === 'string') {
        return isRoutePatternToken(raw) ? { source: 'route_pattern' } : { source: 'fixed', value: raw };
    }
    return { source: 'route_pattern' };
}
function liftAddressFields(type, params) {
    const spec = ADDRESS_STRING_FIELDS[type];
    if (!spec)
        return { params, changed: false };
    const current = params[spec.to];
    if (isValueSource(current)) {
        const next = { ...params };
        let changed = false;
        if (spec.from !== spec.to && spec.from in next) {
            delete next[spec.from];
            changed = true;
        }
        if (spec.useExtenField && spec.useExtenField in next) {
            delete next[spec.useExtenField];
            changed = true;
        }
        return { params: next, changed };
    }
    const fromVal = spec.from in params ? params[spec.from] : current;
    const useExten = spec.useExtenField ? params[spec.useExtenField] : undefined;
    const hasLegacy = spec.from in params
        || (typeof current === 'string')
        || Boolean(useExten);
    if (!hasLegacy && current !== undefined && current !== null) {
        return { params, changed: false };
    }
    if (!hasLegacy && current === undefined) {
        return { params, changed: false };
    }
    const next = { ...params };
    next[spec.to] = toValueSource(fromVal ?? current, useExten);
    if (spec.from !== spec.to)
        delete next[spec.from];
    if (spec.useExtenField)
        delete next[spec.useExtenField];
    return { params: next, changed: true };
}
/**
 * Types merged into a single app with a discriminator param: busy/congestion
 * into hangup(signal), branch into goto(condition), setclid_* into
 * callerid(mode).
 */
function foldMergedTypes(type, params) {
    if (type === 'busy' || type === 'congestion') {
        return { type: 'hangup', params: { ...params, signal: type }, changed: true };
    }
    if (type === 'hangup' && params.signal == null) {
        return { type: 'hangup', params: { ...params, signal: 'hangup' }, changed: true };
    }
    if (type === 'branch') {
        const { true_label, ...rest } = params;
        return {
            type: 'goto',
            params: { ...rest, label_name: true_label ?? params.label_name ?? '' },
            changed: true,
        };
    }
    if (type === 'setclid_custom') {
        const { mode, ...rest } = params;
        return { type: 'callerid', params: { ...rest, mode: 'static' }, changed: true };
    }
    if (type === 'setclid_list') {
        const { mode, ...rest } = params;
        return { type: 'callerid', params: { ...rest, mode: 'number_list' }, changed: true };
    }
    if (type === 'callerid' && params.mode === 'setclid_list') {
        return { type: 'callerid', params: { ...params, mode: 'number_list' }, changed: true };
    }
    return null;
}
function foldPlayback(type, params) {
    if (type === 'playprompt') {
        return { type: 'playback', params: { ...params, mode: params.mode ?? 'plain' }, changed: true };
    }
    if (type === 'background') {
        return { type: 'playback', params: { ...params, mode: params.mode ?? 'menu' }, changed: true };
    }
    if (type === 'playback' && params.mode == null) {
        return { type: 'playback', params: { ...params, mode: 'control' }, changed: true };
    }
    return null;
}
function liftQueuePriority(type, params) {
    if (type !== 'toqueue')
        return { params, changed: false };
    const raw = params.priority;
    if (raw == null || raw === '')
        return { params, changed: false };
    if (isValueSource(raw))
        return { params, changed: false };
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return {
            params: { ...params, priority: { source: 'fixed', value: String(Math.trunc(raw)) } },
            changed: true,
        };
    }
    if (typeof raw === 'string' && raw.trim() !== '') {
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n))
            return { params, changed: false };
        return {
            params: { ...params, priority: { source: 'fixed', value: String(n) } },
            changed: true,
        };
    }
    return { params, changed: false };
}
/**
 * D-54: expand stored `type: 'voicemail'` params without renaming the ActionType.
 * Reuses the existing exten→target lift. Non-voicemail actions pass through.
 * Leftover keys (including a telegram channel string) are kept.
 */
function migrateVoicemailParams(action) {
    if (!isPlainObject(action) || action.type !== 'voicemail') {
        return { action, changed: false };
    }
    const params = isPlainObject(action.params) ? { ...action.params } : {};
    const lifted = liftAddressFields('voicemail', params);
    let nextParams = lifted.params;
    let changed = lifted.changed;
    if (nextParams.max_duration == null) {
        nextParams = { ...nextParams, max_duration: exports.VOICEMAIL_DEFAULT_MAX_DURATION };
        changed = true;
    }
    if (!changed) {
        return { action, changed: false };
    }
    return { action: { ...action, type: 'voicemail', params: nextParams }, changed: true };
}
/**
 * Rewrite one stored action onto the Phase-12 params model.
 * Unmapped hard-remove types (asr/tofax/keywords) and unknown types stay as-is.
 */
function migrateAction(action) {
    if (!isPlainObject(action) || typeof action.type !== 'string') {
        return { action, changed: false };
    }
    const type = action.type;
    const params = isPlainObject(action.params) ? { ...action.params } : {};
    if (exports.UNMAPPED_HARD_REMOVE.has(type)) {
        return { action, changed: false, unmapped: type };
    }
    const playback = foldPlayback(type, params);
    const merged = playback ? null : foldMergedTypes(type, params);
    let nextType = playback?.type ?? merged?.type ?? type;
    let nextParams = playback?.params ?? merged?.params ?? params;
    let changed = Boolean(playback?.changed || merged?.changed);
    const lifted = liftAddressFields(nextType, nextParams);
    nextParams = lifted.params;
    if (lifted.changed)
        changed = true;
    const prioLift = liftQueuePriority(nextType, nextParams);
    nextParams = prioLift.params;
    if (prioLift.changed)
        changed = true;
    if (nextType === 'trunk_carousel') {
        nextType = 'totrunk';
        nextParams = {
            trunkMode: 'carousel',
            ...nextParams,
        };
        changed = true;
    }
    if (['totrunk', 'toexten', 'tolist', 'toroute'].includes(nextType)) {
        const rewriteLift = (0, shared_1.liftDialTargetRewrite)(nextParams);
        nextParams = rewriteLift.params;
        if (rewriteLift.changed)
            changed = true;
    }
    if (!changed) {
        if (!KNOWN_TYPES.has(type)) {
            return { action, changed: false, unmapped: type };
        }
        return { action, changed: false };
    }
    const nextAction = { ...action, type: nextType, params: nextParams };
    return { action: nextAction, changed: true };
}
/** Apply `migrateAction` to every element of an action chain (or a lone action). */
function migrateActionChain(value, migrate = migrateAction) {
    if (value == null) {
        return { value, changed: false, converted: 0, unmapped: [] };
    }
    const items = Array.isArray(value) ? value : [value];
    const unmapped = [];
    let converted = 0;
    let changed = false;
    const next = items.map((item, index) => {
        const result = migrate(item);
        if (result.unmapped)
            unmapped.push({ type: result.unmapped, index });
        if (result.changed) {
            converted += 1;
            changed = true;
        }
        return result.action;
    });
    return {
        value: Array.isArray(value) ? next : next[0],
        changed,
        converted,
        unmapped,
    };
}
//# sourceMappingURL=dialplan-actions-migration.util.js.map