"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldUseStoredRawDialplan = shouldUseStoredRawDialplan;
/**
 * raw_dialplan is an explicit override (Dialplan tab), not a cache of the last apply.
 * A leftover snapshot must not reorder a table-edited action chain.
 */
function shouldUseStoredRawDialplan(route) {
    const raw = route.raw_dialplan?.trim();
    if (!raw)
        return false;
    if (route.options?.dialplan_source === 'raw')
        return true;
    if (route.options?.dialplan_source === 'actions')
        return false;
    return !Array.isArray(route.actions) || route.actions.length === 0;
}
//# sourceMappingURL=route-dialplan-source.util.js.map