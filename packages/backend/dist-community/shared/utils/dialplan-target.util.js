"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveValueSource = resolveValueSource;
exports.resolveQueueValueSource = resolveQueueValueSource;
exports.resolveQueuePriority = resolveQueuePriority;
exports.queuePriorityExpr = queuePriorityExpr;
exports.normalizeTarget = normalizeTarget;
const dialplan_util_1 = require("./dialplan.util");
function resolveValueSource(params, field, legacy) {
    const p = params ?? {};
    const nested = p[field];
    if (nested && typeof nested === 'object' && typeof nested.source === 'string') {
        return nested;
    }
    if (legacy?.useExtenField && p[legacy.useExtenField]) {
        return { source: 'route_pattern' };
    }
    const legacyVal = legacy?.stringField ? p[legacy.stringField] : undefined;
    if (typeof nested === 'string') {
        if (nested === '${EXTEN}' || nested === '__USE_EXTEN__' || nested === '') {
            return { source: 'route_pattern' };
        }
        return { source: 'fixed', value: nested };
    }
    if (typeof legacyVal === 'string') {
        if (legacyVal === '${EXTEN}' || legacyVal === '__USE_EXTEN__' || legacyVal === '') {
            return { source: 'route_pattern' };
        }
        return { source: 'fixed', value: legacyVal };
    }
    return { source: 'route_pattern' };
}
function resolveQueueValueSource(params) {
    const p = params ?? {};
    if (p.target && typeof p.target === 'object' && typeof p.target.source === 'string') {
        return p.target;
    }
    const queue = typeof p.queue === 'string' ? p.queue : '';
    if (queue)
        return { source: 'fixed', value: queue };
    return { source: 'route_pattern' };
}
/**
 * Dual-read queue priority: ValueSource, legacy number, or numeric string.
 * `route_pattern` is not valid for QUEUE_PRIO.
 */
function resolveQueuePriority(params) {
    const raw = params?.priority;
    if (raw == null || raw === '')
        return undefined;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return { source: 'fixed', value: String(Math.trunc(raw)) };
    }
    if (typeof raw === 'string' && raw.trim() !== '') {
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n))
            return undefined;
        return { source: 'fixed', value: String(n) };
    }
    if (raw && typeof raw === 'object' && typeof raw.source === 'string') {
        if (raw.source === 'route_pattern')
            return undefined;
        const src = raw;
        if (src.source === 'fixed') {
            if (!String(src.value ?? '').trim())
                return undefined;
            return src;
        }
        if (src.source === 'variable') {
            if (!String(src.name ?? '').trim())
                return undefined;
            return src;
        }
        if (src.source === 'directory') {
            const dir = src;
            if (!(Number(dir.directoryUid) > 0) || !(Number(dir.valueFieldUid) > 0))
                return undefined;
            return src;
        }
    }
    return undefined;
}
/** Right-hand side of Set(QUEUE_PRIO=…). */
function queuePriorityExpr(src, directoryValueVar) {
    if (src.source === 'fixed') {
        const n = parseInt(String(src.value), 10);
        if (!Number.isFinite(n))
            return undefined;
        return String(n);
    }
    if (src.source === 'variable') {
        const name = dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(src.name);
        return name ? `\${${name}}` : undefined;
    }
    if (src.source === 'directory') {
        return directoryValueVar ? `\${${directoryValueVar}}` : undefined;
    }
    return undefined;
}
function normalizeTarget(kind, src, uid, opts) {
    const raw = src.source === 'fixed'
        ? dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(src.value)
        : src.source === 'route_pattern'
            ? '${EXTEN}'
            : src.source === 'variable' || src.source === 'autodial_field'
                ? `\${${dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(src.name)}}`
                : src.source === 'original_caller'
                    ? '${KRSK_ORIG_CALLER_NUM}'
                    : src.source === 'current_caller'
                        ? '${CALLERID(num)}'
                        : src.source === 'directory' && opts?.directoryValueVar
                            ? `\${${opts.directoryValueVar}}`
                            : '${EXTEN}';
    switch (kind) {
        case 'queue': {
            // Legacy QueueApp stored the already-scoped Asterisk name (q{exten}_{uid}).
            if (new RegExp(`^q.+_${uid}$`).test(raw))
                return raw;
            return `q${raw}_${uid}`;
        }
        case 'group':
            return `group_${raw}_${uid}`;
        case 'exten':
            return dialplan_util_1.AsteriskDialplanUtils.pjsipDialTarget(raw, uid, { webrtc: opts?.webrtc !== false });
        case 'context': {
            const suffix = String(uid);
            return raw.endsWith(suffix) ? raw : `${raw}${suffix}`;
        }
        case 'conference': {
            if (new RegExp(`^conf.+_${uid}$`).test(raw))
                return raw;
            return `conf${raw}_${uid}`;
        }
        default: {
            const _never = kind;
            return _never;
        }
    }
}
//# sourceMappingURL=dialplan-target.util.js.map