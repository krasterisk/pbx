"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectLabels = collectLabels;
exports.validateLabelRefs = validateLabelRefs;
function actionIdOf(action, index) {
    return typeof action.id === 'string' && action.id ? action.id : `index:${index}`;
}
function labelName(value) {
    return typeof value === 'string' ? value.trim() : '';
}
/** Map of label name → first step index in the chain (D-44). */
function collectLabels(actions) {
    const map = new Map();
    (Array.isArray(actions) ? actions : []).forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            return;
        const action = item;
        if (action.type !== 'label')
            return;
        const name = labelName(action.params?.label_name);
        if (!name || map.has(name))
            return;
        map.set(name, index);
    });
    return map;
}
/**
 * Reject duplicate label names and jumps to missing labels (D-44).
 * Error shape matches ActionParamsError from 12-03.
 */
function validateLabelRefs(actions) {
    const list = Array.isArray(actions) ? actions : [];
    const errors = [];
    const seen = new Map();
    list.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            return;
        const action = item;
        if (action.type !== 'label')
            return;
        const name = labelName(action.params?.label_name);
        if (!name)
            return;
        const actionId = actionIdOf(action, index);
        if (seen.has(name)) {
            errors.push({
                actionId,
                path: 'params.label_name',
                message: `duplicate label "${name}"`,
            });
            return;
        }
        seen.set(name, actionId);
    });
    list.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            return;
        const action = item;
        const actionId = actionIdOf(action, index);
        const refs = [];
        if (action.type === 'goto') {
            refs.push({ path: 'params.label_name', name: labelName(action.params?.label_name) });
            refs.push({ path: 'params.false_label', name: labelName(action.params?.false_label) });
        }
        for (const ref of refs) {
            if (!ref.name)
                continue;
            if (!seen.has(ref.name)) {
                errors.push({
                    actionId,
                    path: ref.path,
                    message: `unknown label "${ref.name}"`,
                });
            }
        }
    });
    return errors;
}
//# sourceMappingURL=dialplan-labels.util.js.map