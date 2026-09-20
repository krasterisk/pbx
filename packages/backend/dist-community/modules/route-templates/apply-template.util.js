"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTemplateActions = applyTemplateActions;
exports.resolveSlotFill = resolveSlotFill;
const crypto_1 = require("crypto");
const shared_1 = require("@krasterisk/shared");
function applyTemplateActions(actions, slots, slotValues) {
    const byId = new Map(slots.map((slot) => [slot.id, slot]));
    return actions.map((action) => {
        const cloned = structuredClone(action);
        cloned.id = (0, crypto_1.randomUUID)();
        cloned.params = replaceMarkers(cloned.params, byId, slotValues);
        return cloned;
    });
}
function replaceMarkers(value, slots, slotValues) {
    if (typeof value === 'string') {
        const slotId = (0, shared_1.parseTemplateSlotMarker)(value);
        if (!slotId)
            return value;
        const slot = slots.get(slotId);
        const filled = slotValues[slotId];
        if (!slot || !filled)
            return value;
        return resolveSlotFill(slot, filled);
    }
    if (Array.isArray(value)) {
        return value.map((item) => replaceMarkers(item, slots, slotValues));
    }
    if (value && typeof value === 'object') {
        const next = {};
        for (const [key, child] of Object.entries(value)) {
            next[key] = replaceMarkers(child, slots, slotValues);
        }
        return next;
    }
    return value;
}
function resolveSlotFill(_slot, value) {
    // Catalog `uid` is the value the route editor stores (queue exten, prompt filename, …).
    // `name` is a display label and must not be written into params.
    return String(value.uid);
}
//# sourceMappingURL=apply-template.util.js.map