"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateActionParams = validateActionParams;
exports.assertValidActionParams = assertValidActionParams;
exports.collectHostActionErrors = collectHostActionErrors;
exports.throwIfInvalidActionPayload = throwIfInvalidActionPayload;
exports.collectNestedActionChains = collectNestedActionChains;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const shared_1 = require("@krasterisk/shared");
const route_action_dto_1 = require("../../modules/routes/dto/route-action.dto");
const dialplan_params_1 = require("../../modules/routes/dto/dialplan-params");
const dialplan_labels_util_1 = require("../utils/dialplan-labels.util");
function flattenErrors(errors, actionId, prefix = '') {
    const out = [];
    for (const err of errors) {
        const path = prefix ? `${prefix}.${err.property}` : err.property;
        if (err.constraints) {
            for (const message of Object.values(err.constraints)) {
                out.push({ actionId, path, message });
            }
        }
        if (err.children?.length) {
            out.push(...flattenErrors(err.children, actionId, path));
        }
    }
    return out;
}
function actionIdOf(action, index) {
    return typeof action.id === 'string' && action.id ? action.id : `index:${index}`;
}
function validateOne(action, index) {
    const actionId = actionIdOf(action, index);
    if (!action.type) {
        return [{ actionId, path: 'type', message: `action ${actionId} has empty type` }];
    }
    const type = String(action.type);
    if (!route_action_dto_1.ActionTypesList.includes(type)) {
        return [{ actionId, path: 'type', message: `unknown action type: ${type}` }];
    }
    const Dto = (0, dialplan_params_1.resolveParamsDto)(type);
    const params = action.params;
    if (Dto === null) {
        if (params != null && (typeof params !== 'object' || Array.isArray(params))) {
            return [{ actionId, path: 'params', message: 'params must be an object' }];
        }
        return [];
    }
    if (params == null || typeof params !== 'object' || Array.isArray(params)) {
        return [{ actionId, path: 'params', message: 'params must be an object' }];
    }
    const next = { ...params };
    if (type === 'totrunk' && 'dest' in next) {
        next.dest = (0, shared_1.coerceDestValueSource)(next.dest);
    }
    if (type === 'toroute' && 'extension' in next && (typeof next.extension === 'string' || next.extension == null)) {
        next.extension = (0, shared_1.coerceDestValueSource)(next.extension);
    }
    const instance = (0, class_transformer_1.plainToInstance)(Dto, next);
    const errors = (0, class_validator_1.validateSync)(instance, { whitelist: true });
    return flattenErrors(errors, actionId);
}
function validateActionParams(actions) {
    if (!Array.isArray(actions)) {
        return [{ actionId: null, path: 'actions', message: 'actions must be an array' }];
    }
    const out = [];
    actions.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            out.push({ actionId: `index:${index}`, path: 'type', message: `action index:${index} is invalid` });
            return;
        }
        out.push(...validateOne(item, index));
    });
    return out.sort((a, b) => {
        const id = (a.actionId || '').localeCompare(b.actionId || '');
        return id !== 0 ? id : a.path.localeCompare(b.path);
    });
}
function assertValidActionParams(actions) {
    const errors = validateActionParams(actions);
    if (errors.length) {
        throw new common_1.BadRequestException({ errors });
    }
}
function collectHostActionErrors(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
        return [];
    const record = body;
    const errors = [];
    if (record.name === '') {
        errors.push({ actionId: null, path: 'name', message: 'name must be a non-empty string' });
    }
    errors.push(...validateActionParams(collectNestedActionChains(record)));
    for (const chain of collectLabelChains(record)) {
        errors.push(...(0, dialplan_labels_util_1.validateLabelRefs)(chain));
    }
    return errors;
}
function collectLabelChains(body) {
    const chains = [];
    if (Array.isArray(body.actions))
        chains.push(body.actions);
    if (body.fallback_action)
        chains.push([body.fallback_action]);
    if (body.max_retries_action)
        chains.push([body.max_retries_action]);
    if (Array.isArray(body.bindings)) {
        for (const binding of body.bindings) {
            if (Array.isArray(binding?.actions))
                chains.push(binding.actions);
        }
    }
    if (Array.isArray(body.menu_items)) {
        for (const item of body.menu_items) {
            if (Array.isArray(item?.actions))
                chains.push(item.actions);
        }
    }
    if (Array.isArray(body.keywords)) {
        for (const kw of body.keywords) {
            if (Array.isArray(kw?.actions))
                chains.push(kw.actions);
        }
    }
    if (Array.isArray(body.keyword_groups)) {
        for (const group of body.keyword_groups) {
            for (const kw of group?.keywords ?? []) {
                if (Array.isArray(kw?.actions))
                    chains.push(kw.actions);
            }
        }
    }
    return chains;
}
function throwIfInvalidActionPayload(body) {
    const errors = collectHostActionErrors(body);
    if (errors.length) {
        throw new common_1.BadRequestException({ errors });
    }
}
function collectNestedActionChains(body) {
    const chains = [];
    if (Array.isArray(body.actions))
        chains.push(...body.actions);
    if (body.fallback_action)
        chains.push(body.fallback_action);
    if (body.max_retries_action)
        chains.push(body.max_retries_action);
    if (Array.isArray(body.bindings)) {
        for (const binding of body.bindings) {
            if (Array.isArray(binding?.actions))
                chains.push(...binding.actions);
        }
    }
    if (Array.isArray(body.menu_items)) {
        for (const item of body.menu_items) {
            if (Array.isArray(item?.actions))
                chains.push(...item.actions);
        }
    }
    if (Array.isArray(body.keywords)) {
        for (const kw of body.keywords) {
            if (Array.isArray(kw?.actions))
                chains.push(...kw.actions);
        }
    }
    if (Array.isArray(body.keyword_groups)) {
        for (const group of body.keyword_groups) {
            for (const kw of group?.keywords ?? []) {
                if (Array.isArray(kw?.actions))
                    chains.push(...kw.actions);
            }
        }
    }
    return chains;
}
//# sourceMappingURL=action-params-validation.util.js.map