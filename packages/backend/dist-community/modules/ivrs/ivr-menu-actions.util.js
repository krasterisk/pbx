"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IVR_ACTION_ALIASES = void 0;
exports.asIvrDestination = asIvrDestination;
exports.actionFromIvrDestination = actionFromIvrDestination;
exports.asIvrMenuItems = asIvrMenuItems;
exports.destinationFromIvrActions = destinationFromIvrActions;
exports.targetValueFromParams = targetValueFromParams;
exports.normalizeIvrMenuItems = normalizeIvrMenuItems;
exports.summarizeIvrMenu = summarizeIvrMenu;
const tenant_public_id_util_1 = require("../../shared/utils/tenant-public-id.util");
const dialplan_actions_migration_util_1 = require("../routes/dialplan-actions-migration.util");
const route_action_dto_1 = require("../routes/dto/route-action.dto");
/** Agent / leftover names that are not ActionType and must not be persisted. */
exports.IVR_ACTION_ALIASES = {
    dial: 'toexten',
    toendpoint: 'toexten',
    toextension: 'toexten',
    tocontext: 'toroute',
};
const KNOWN_ACTION_TYPES = new Set(route_action_dto_1.ActionTypesList);
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function asIvrDestination(value) {
    const rec = isPlainObject(value) ? value : {};
    return {
        kind: String(rec.kind || 'queue'),
        target: String(rec.target ?? ''),
    };
}
function actionFromIvrDestination(dest, opts = {}) {
    const digit = opts.digit ?? 'x';
    const index = opts.index ?? 0;
    const condition = {};
    if (dest.kind === 'queue') {
        return typedAction('toqueue', {
            digit,
            index,
            params: { target: { source: 'fixed', value: (0, tenant_public_id_util_1.toPublicExten)(dest.target) } },
            condition,
        });
    }
    if (dest.kind === 'menu') {
        return typedAction('toivr', {
            digit,
            index,
            params: { ivr_uid: Number(dest.target) || dest.target },
            condition,
        });
    }
    if (dest.kind === 'extension') {
        return typedAction('toexten', {
            digit,
            index,
            params: {
                target: { source: 'fixed', value: (0, tenant_public_id_util_1.toPublicExten)(dest.target) },
                webrtc: true,
            },
            condition,
        });
    }
    if (dest.kind === 'group') {
        return typedAction('togroup', {
            digit,
            index,
            params: { target: { source: 'fixed', value: String(dest.target) } },
            condition,
        });
    }
    return typedAction('toroute', {
        digit,
        index,
        params: { context: dest.target },
        condition,
    });
}
function asIvrMenuItems(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((item) => {
        const rec = isPlainObject(item) ? item : {};
        let actions = Array.isArray(rec.actions)
            ? rec.actions.filter((row) => isPlainObject(row))
            : [];
        if (!actions.length && rec.destination) {
            const dest = asIvrDestination(rec.destination);
            actions = [actionFromIvrDestination(dest, { digit: String(rec.digit ?? '') })];
        }
        return { digit: String(rec.digit ?? ''), actions };
    });
}
function destinationFromIvrActions(actions) {
    if (!Array.isArray(actions))
        return null;
    for (const action of actions) {
        if (!isPlainObject(action))
            continue;
        const type = String(action.type || '');
        const params = isPlainObject(action.params) ? action.params : {};
        if (type === 'toqueue') {
            return { kind: 'queue', target: String(targetValueFromParams(params) ?? '') };
        }
        if (type === 'toivr') {
            return { kind: 'menu', target: String(params.ivr_uid ?? '') };
        }
        if (type === 'toexten' || type === 'dial' || type === 'toendpoint' || type === 'toextension') {
            return { kind: 'extension', target: String(targetValueFromParams(params) ?? params.extension ?? '') };
        }
        if (type === 'toroute') {
            return { kind: 'context', target: String(params.context ?? targetValueFromParams(params) ?? '') };
        }
        if (type === 'goto' || type === 'tocontext') {
            if (params.context || params.context_name) {
                return { kind: 'context', target: String(params.context ?? params.context_name ?? '') };
            }
        }
        if (type === 'togroup') {
            return { kind: 'group', target: String(params.group ?? targetValueFromParams(params) ?? '') };
        }
    }
    return null;
}
function targetValueFromParams(params) {
    const target = params.target;
    if (typeof target === 'string' || typeof target === 'number')
        return target;
    if (isPlainObject(target) && target.value != null)
        return target.value;
    return params.queue ?? params.group;
}
function normalizeIvrMenuItems(value, tenantUid) {
    const parsed = asIvrMenuItems(value);
    const aliases = [];
    const unmapped = [];
    const items = parsed.map((item) => {
        const actions = item.actions.map((action, index) => {
            const result = normalizeOneIvrAction(action, item.digit, index, tenantUid);
            if (result.alias)
                aliases.push({ digit: item.digit, ...result.alias });
            if (result.unmapped)
                unmapped.push({ digit: item.digit, type: result.unmapped });
            return result.action;
        });
        return { digit: item.digit, actions };
    });
    return { items, aliases, unmapped };
}
function summarizeIvrMenu(value) {
    return asIvrMenuItems(value)
        .map((item) => {
        const types = item.actions.map((action) => String(action.type || '?')).join('+') || 'none';
        return `${item.digit}:${types}`;
    })
        .join(',') || '(empty)';
}
function typedAction(type, opts) {
    return {
        id: actionId(undefined, opts.digit, opts.index, type),
        type,
        params: opts.params,
        condition: opts.condition,
    };
}
function normalizeOneIvrAction(action, digit, index, tenantUid) {
    const fromType = String(action.type || '');
    let type = exports.IVR_ACTION_ALIASES[fromType] ?? fromType;
    let params = isPlainObject(action.params) ? { ...action.params } : {};
    if (type === 'goto' && params.context && !params.label_name) {
        type = 'toroute';
    }
    const migrated = (0, dialplan_actions_migration_util_1.migrateAction)({ ...action, type, params });
    const next = isPlainObject(migrated.action) ? migrated.action : { ...action, type, params };
    type = String(next.type || type);
    params = isPlainObject(next.params) ? { ...next.params } : params;
    if (type === 'toexten' || type === 'toqueue') {
        params = publicizeFixedTarget(params, tenantUid);
    }
    if (type === 'toroute') {
        params = flattenTorouteContext(params);
    }
    if (type === 'toexten' && params.webrtc == null) {
        params = { ...params, webrtc: true };
    }
    const normalized = {
        id: actionId(action.id, digit, index, type || 'unknown'),
        type,
        params,
        condition: isPlainObject(action.condition) ? action.condition : (isPlainObject(next.condition) ? next.condition : {}),
    };
    if (!type || !KNOWN_ACTION_TYPES.has(type) || migrated.unmapped) {
        return {
            action: normalized,
            alias: fromType && fromType !== type ? { from: fromType, to: type } : undefined,
            unmapped: migrated.unmapped || type || 'unknown',
        };
    }
    return {
        action: normalized,
        alias: fromType && fromType !== type ? { from: fromType, to: type } : undefined,
    };
}
function flattenTorouteContext(params) {
    const context = params.context;
    if (isPlainObject(context) && context.value != null) {
        return { ...params, context: String(context.value) };
    }
    return params;
}
function publicizeFixedTarget(params, tenantUid) {
    const target = params.target;
    if (!isPlainObject(target) || target.source !== 'fixed' || target.value == null) {
        return params;
    }
    return {
        ...params,
        target: { ...target, value: (0, tenant_public_id_util_1.toPublicExten)(target.value, tenantUid) },
    };
}
function actionId(existing, digit, index, type) {
    if (typeof existing === 'string' && existing.trim())
        return existing;
    const safeDigit = String(digit || 'x').replace(/[^0-9a-zA-Z_*#tTiI]/g, '') || 'x';
    return `ivr-${safeDigit}-${index}-${type}`;
}
//# sourceMappingURL=ivr-menu-actions.util.js.map