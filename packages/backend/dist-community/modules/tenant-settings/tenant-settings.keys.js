"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GLOBAL_SETTING_KEYS = exports.TENANT_SETTING_KEYS = void 0;
exports.assertDisjointKeySets = assertDisjointKeySets;
const system_settings_service_1 = require("../system-settings/system-settings.service");
/**
 * Single source of truth for tenant-scoped setting keys (D-19).
 * D-17 visibility flags default ON (true) — absence of a row means enabled.
 */
exports.TENANT_SETTING_KEYS = {
    'routes.show_raw_dialplan': { type: 'boolean', default: true, category: 'routes' },
    'routes.show_flowchart': { type: 'boolean', default: true, category: 'routes' },
};
/** Keys owned by global `system-settings` — must never appear in TENANT_SETTING_KEYS. */
exports.GLOBAL_SETTING_KEYS = new Set(system_settings_service_1.MANAGED_KEYS);
function assertDisjointKeySets() {
    const overlap = Object.keys(exports.TENANT_SETTING_KEYS).filter((k) => exports.GLOBAL_SETTING_KEYS.has(k));
    if (overlap.length) {
        throw new Error(`TENANT_SETTING_KEYS overlaps GLOBAL_SETTING_KEYS: ${overlap.join(', ')}`);
    }
}
assertDisjointKeySets();
//# sourceMappingURL=tenant-settings.keys.js.map