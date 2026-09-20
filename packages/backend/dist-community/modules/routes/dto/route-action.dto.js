"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRouteDto = exports.CreateRouteDto = exports.RouteDirectoryBindingDto = exports.RouteActionDto = exports.RouteActionConditionDto = exports.ActionTypesList = void 0;
exports.formatRouteValidationErrors = formatRouteValidationErrors;
exports.createRoutesValidationPipe = createRoutesValidationPipe;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const common_1 = require("@nestjs/common");
const toqueue_params_dto_1 = require("./dialplan-params/toqueue.params.dto");
const directory_lookup_params_dto_1 = require("./dialplan-params/directory-lookup.params.dto");
const value_source_dto_1 = require("./dialplan-params/value-source.dto");
const route_condition_dto_1 = require("./route-condition.dto");
exports.ActionTypesList = [
    'totrunk', 'toexten', 'toqueue', 'togroup', 'tolist',
    'toivr', 'toroute', 'playback',
    'notify', 'callerid',
    'voicemail', 'text2speech', 'voicerobot', 'ai_voice_robot',
    'webhook', 'confbridge', 'cmd',
    'label', 'goto', 'schedule',
    'http_request', 'collect_input',
    'hangup', 'directory_lookup',
    'callback',
];
const MatchModesList = ['on_match', 'on_no_match'];
const BehaviorTypesList = [
    'set_name', 'set_number', 'drop',
    'redirect', 'map_fields', 'custom',
];
function directoryBehaviorParamsValid(behaviorType, params) {
    const p = params || {};
    if (behaviorType === 'set_name' || behaviorType === 'set_number') {
        if (typeof p.fixed === 'string' && p.fixed.length > 0)
            return true;
        return Number.isInteger(p.fieldUid) && p.fieldUid > 0;
    }
    if (behaviorType === 'redirect') {
        if (typeof p.fixedExten === 'string' && p.fixedExten.length > 0)
            return true;
        return Number.isInteger(p.fieldUid) && p.fieldUid > 0;
    }
    if (behaviorType === 'map_fields') {
        return Array.isArray(p.mappings)
            && p.mappings.length > 0
            && p.mappings.every((m) => Number.isInteger(m?.fieldUid) && m.fieldUid > 0);
    }
    return true;
}
let IsDirectoryBindingBehaviorConstraint = class IsDirectoryBindingBehaviorConstraint {
    validate(_value, args) {
        const binding = args.object;
        return directoryBehaviorParamsValid(binding.behavior_type, binding.behavior_params);
    }
    defaultMessage() {
        return 'field-consuming behavior requires fieldUid (or fixed/fixedExten); map_fields requires mappings';
    }
};
IsDirectoryBindingBehaviorConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isDirectoryBindingBehavior', async: false })
], IsDirectoryBindingBehaviorConstraint);
const toQueueParamErrors = new WeakMap();
let IsTypedActionParamsConstraint = class IsTypedActionParamsConstraint {
    validate(params, args) {
        if (!params || typeof params !== 'object' || Array.isArray(params))
            return false;
        const action = args.object;
        if (action.type === 'toqueue') {
            const dto = (0, class_transformer_1.plainToInstance)(toqueue_params_dto_1.ToQueueParamsDto, params);
            const errors = (0, class_validator_1.validateSync)(dto);
            toQueueParamErrors.set(action, errors);
            return errors.length === 0;
        }
        if (action.type !== 'directory_lookup')
            return true;
        const dto = (0, class_transformer_1.plainToInstance)(directory_lookup_params_dto_1.DirectoryLookupParamsDto, params);
        const errors = (0, class_validator_1.validateSync)(dto);
        toQueueParamErrors.set(action, errors);
        return errors.length === 0;
    }
    defaultMessage(args) {
        const nested = toQueueParamErrors.get(args.object) ?? [];
        if (nested.length) {
            return nested
                .flatMap((err) => Object.values(err.constraints ?? {}))
                .filter(Boolean)
                .join('; ') || 'params are invalid';
        }
        return 'params must be an object';
    }
};
IsTypedActionParamsConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isTypedActionParams', async: false })
], IsTypedActionParamsConstraint);
function formatRouteValidationErrors(errors) {
    const out = [];
    const walk = (list, prefix, inheritedId) => {
        for (const err of list) {
            const path = prefix ? `${prefix}.${err.property}` : err.property;
            const target = err.target;
            const actionId = target?.id || inheritedId;
            if (err.constraints) {
                for (const message of Object.values(err.constraints)) {
                    out.push({ actionId: actionId || null, path, message });
                }
            }
            if (err.children?.length) {
                walk(err.children, path, actionId || inheritedId);
            }
        }
    };
    walk(errors, '', null);
    return out;
}
function createRoutesValidationPipe() {
    return new common_1.ValidationPipe({
        transform: true,
        whitelist: true,
        exceptionFactory: (errors) => new common_1.BadRequestException({ errors: formatRouteValidationErrors(errors) }),
    });
}
class RouteActionConditionDto extends route_condition_dto_1.RouteConditionDto {
    time_group_uid;
    calendar;
}
exports.RouteActionConditionDto = RouteActionConditionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RouteActionConditionDto.prototype, "time_group_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RouteActionConditionDto.prototype, "calendar", void 0);
class RouteActionDto {
    id;
    type;
    params;
    condition;
}
exports.RouteActionDto = RouteActionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RouteActionDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.ActionTypesList),
    __metadata("design:type", String)
], RouteActionDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.Validate)(IsTypedActionParamsConstraint),
    __metadata("design:type", Object)
], RouteActionDto.prototype, "params", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => RouteActionConditionDto),
    __metadata("design:type", RouteActionConditionDto)
], RouteActionDto.prototype, "condition", void 0);
// Bindings sent by clients omit uid/route_uid — replace-all strategy assigns
// route_uid and position (array index) server-side (RoutesService.replaceBindings).
class RouteDirectoryBindingDto {
    directory_uid;
    position;
    key_source;
    match_mode;
    behavior_type;
    behavior_params;
    actions;
}
exports.RouteDirectoryBindingDto = RouteDirectoryBindingDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RouteDirectoryBindingDto.prototype, "directory_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RouteDirectoryBindingDto.prototype, "position", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => value_source_dto_1.CallValueSourceDto),
    __metadata("design:type", value_source_dto_1.CallValueSourceDto)
], RouteDirectoryBindingDto.prototype, "key_source", void 0);
__decorate([
    (0, class_validator_1.IsIn)(MatchModesList),
    __metadata("design:type", String)
], RouteDirectoryBindingDto.prototype, "match_mode", void 0);
__decorate([
    (0, class_validator_1.IsIn)(BehaviorTypesList),
    (0, class_validator_1.Validate)(IsDirectoryBindingBehaviorConstraint),
    __metadata("design:type", String)
], RouteDirectoryBindingDto.prototype, "behavior_type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], RouteDirectoryBindingDto.prototype, "behavior_params", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => RouteActionDto),
    __metadata("design:type", Array)
], RouteDirectoryBindingDto.prototype, "actions", void 0);
class CreateRouteDto {
    context_uid;
    name;
    extensions;
    active;
    options;
    webhooks;
    actions;
    raw_dialplan;
    bindings;
}
exports.CreateRouteDto = CreateRouteDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateRouteDto.prototype, "context_uid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRouteDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateRouteDto.prototype, "extensions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateRouteDto.prototype, "active", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateRouteDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateRouteDto.prototype, "webhooks", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => RouteActionDto),
    __metadata("design:type", Array)
], CreateRouteDto.prototype, "actions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRouteDto.prototype, "raw_dialplan", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => RouteDirectoryBindingDto),
    __metadata("design:type", Array)
], CreateRouteDto.prototype, "bindings", void 0);
class UpdateRouteDto {
    context_uid;
    name;
    extensions;
    active;
    options;
    webhooks;
    actions;
    raw_dialplan;
    bindings;
}
exports.UpdateRouteDto = UpdateRouteDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateRouteDto.prototype, "context_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRouteDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateRouteDto.prototype, "extensions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateRouteDto.prototype, "active", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateRouteDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateRouteDto.prototype, "webhooks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => RouteActionDto),
    __metadata("design:type", Array)
], UpdateRouteDto.prototype, "actions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRouteDto.prototype, "raw_dialplan", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => RouteDirectoryBindingDto),
    __metadata("design:type", Array)
], UpdateRouteDto.prototype, "bindings", void 0);
//# sourceMappingURL=route-action.dto.js.map