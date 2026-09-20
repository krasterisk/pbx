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
exports.VoicemailParamsDto = exports.RecordOptionsDto = exports.ToTrunkParamsDto = exports.ToRouteParamsDto = exports.ToIvrParamsDto = exports.ToListParamsDto = exports.ToGroupParamsDto = exports.ToQueueParamsDto = exports.ToExtenParamsDto = exports.ConfBridgeParamsDto = exports.DialTargetRewriteDto = exports.DialRewriteRuleDto = exports.DialRewriteTransformDto = exports.DialRewriteConditionDto = exports.NumberManipulationDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const shared_1 = require("@krasterisk/shared");
const value_source_dto_1 = require("./value-source.dto");
const integration_params_dto_1 = require("./integration.params.dto");
const SAFE_DIAL = /^[^(),?\[\]{}$\\";\n\r]*$/;
const PREPEND_DIGITS = /^[0-9+]*$/;
/** Prompt identifier only — no path, no absolute file (T-13-09). */
const SAFE_GREETING = /^[A-Za-z0-9._-]*$/;
class NumberManipulationDto {
    strip;
    prepend;
}
exports.NumberManipulationDto = NumberManipulationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], NumberManipulationDto.prototype, "strip", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(PREPEND_DIGITS),
    __metadata("design:type", String)
], NumberManipulationDto.prototype, "prepend", void 0);
const REWRITE_KINDS = ['eq', 'startsWith', 'endsWith', 'length', 'digitMask', 'regex'];
class DialRewriteConditionDto {
    kind;
    value;
    min;
    max;
}
exports.DialRewriteConditionDto = DialRewriteConditionDto;
__decorate([
    (0, class_validator_1.IsIn)(REWRITE_KINDS),
    __metadata("design:type", Object)
], DialRewriteConditionDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DialRewriteConditionDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(64),
    __metadata("design:type", Number)
], DialRewriteConditionDto.prototype, "min", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(64),
    __metadata("design:type", Number)
], DialRewriteConditionDto.prototype, "max", void 0);
class DialRewriteTransformDto {
    replaceAll;
    stripStartCount;
    stripStartText;
    stripEndCount;
    stripEndText;
    replaceFind;
    replaceWith;
    prefix;
    postfix;
}
exports.DialRewriteTransformDto = DialRewriteTransformDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[0-9A-Za-z+*#]*$/),
    __metadata("design:type", String)
], DialRewriteTransformDto.prototype, "replaceAll", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(32),
    __metadata("design:type", Number)
], DialRewriteTransformDto.prototype, "stripStartCount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[0-9A-Za-z+*#]*$/),
    __metadata("design:type", String)
], DialRewriteTransformDto.prototype, "stripStartText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(32),
    __metadata("design:type", Number)
], DialRewriteTransformDto.prototype, "stripEndCount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[0-9A-Za-z+*#]*$/),
    __metadata("design:type", String)
], DialRewriteTransformDto.prototype, "stripEndText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[0-9A-Za-z+*#]*$/),
    __metadata("design:type", String)
], DialRewriteTransformDto.prototype, "replaceFind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[0-9A-Za-z+*#]*$/),
    __metadata("design:type", String)
], DialRewriteTransformDto.prototype, "replaceWith", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[0-9A-Za-z+*#]*$/),
    __metadata("design:type", String)
], DialRewriteTransformDto.prototype, "prefix", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[0-9A-Za-z+*#]*$/),
    __metadata("design:type", String)
], DialRewriteTransformDto.prototype, "postfix", void 0);
class DialRewriteRuleDto {
    id;
    enabled;
    conditions;
    transform;
}
exports.DialRewriteRuleDto = DialRewriteRuleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], DialRewriteRuleDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DialRewriteRuleDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DialRewriteConditionDto),
    __metadata("design:type", Array)
], DialRewriteRuleDto.prototype, "conditions", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DialRewriteTransformDto),
    __metadata("design:type", DialRewriteTransformDto)
], DialRewriteRuleDto.prototype, "transform", void 0);
class DialTargetRewriteDto {
    rules;
    noMatch;
}
exports.DialTargetRewriteDto = DialTargetRewriteDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DialRewriteRuleDto),
    __metadata("design:type", Array)
], DialTargetRewriteDto.prototype, "rules", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['passthrough', 'reject']),
    __metadata("design:type", String)
], DialTargetRewriteDto.prototype, "noMatch", void 0);
/**
 * ConfBridge params: the room is chosen from tenant conference rooms.
 * The bridge-profile name lives in the conferences module, not in step params.
 */
class ConfBridgeParamsDto {
    room;
}
exports.ConfBridgeParamsDto = ConfBridgeParamsDto;
__decorate([
    (0, class_validator_1.IsDefined)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => value_source_dto_1.ValueSourceDto),
    __metadata("design:type", value_source_dto_1.ValueSourceDto)
], ConfBridgeParamsDto.prototype, "room", void 0);
class ToExtenParamsDto {
    target;
    /** Read by the generator; selects transport in pjsipDialTarget. Revived, not removed (D-39). */
    webrtc;
    timeout;
    options;
    exten;
    useExten;
    numberManipulation;
    rewrite;
}
exports.ToExtenParamsDto = ToExtenParamsDto;
__decorate([
    (0, class_validator_1.IsDefined)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => value_source_dto_1.ValueSourceDto),
    __metadata("design:type", value_source_dto_1.ValueSourceDto)
], ToExtenParamsDto.prototype, "target", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ToExtenParamsDto.prototype, "webrtc", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ToExtenParamsDto.prototype, "timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], ToExtenParamsDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ToExtenParamsDto.prototype, "exten", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ToExtenParamsDto.prototype, "useExten", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => NumberManipulationDto),
    __metadata("design:type", NumberManipulationDto)
], ToExtenParamsDto.prototype, "numberManipulation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DialTargetRewriteDto),
    __metadata("design:type", DialTargetRewriteDto)
], ToExtenParamsDto.prototype, "rewrite", void 0);
class ToQueueParamsDto {
    target;
    timeout;
    options;
    /** @deprecated Wave 0 field — accepted when `target` is absent */
    queue;
    /** VIP skip of the queue tail — Set(QUEUE_PRIO=…) before Queue() (D-32). ValueSource or legacy number. */
    priority;
    /** 4th Queue() argument; prompt id only, never a path (T-12-13-02). */
    announceoverride;
}
exports.ToQueueParamsDto = ToQueueParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => value_source_dto_1.ValueSourceDto),
    (0, class_validator_1.Validate)(value_source_dto_1.IsValueSourceConstraint),
    __metadata("design:type", value_source_dto_1.ValueSourceDto)
], ToQueueParamsDto.prototype, "target", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ToQueueParamsDto.prototype, "timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ToQueueParamsDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ToQueueParamsDto.prototype, "queue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === '' || value == null)
            return undefined;
        if (typeof value === 'number' && Number.isFinite(value)) {
            return { source: 'fixed', value: String(Math.trunc(value)) };
        }
        if (typeof value === 'string' && value.trim() !== '') {
            const n = parseInt(value, 10);
            if (!Number.isFinite(n))
                return value;
            return { source: 'fixed', value: String(n) };
        }
        return value;
    }),
    (0, class_validator_1.Validate)(value_source_dto_1.IsQueuePrioritySourceConstraint),
    __metadata("design:type", value_source_dto_1.ValueSourceDto)
], ToQueueParamsDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^(?!.*\.\.)[^\\/]*$/),
    __metadata("design:type", String)
], ToQueueParamsDto.prototype, "announceoverride", void 0);
class ToGroupParamsDto {
    target;
    group;
    numberManipulation;
}
exports.ToGroupParamsDto = ToGroupParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => value_source_dto_1.ValueSourceDto),
    __metadata("design:type", value_source_dto_1.ValueSourceDto)
], ToGroupParamsDto.prototype, "target", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], ToGroupParamsDto.prototype, "group", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => NumberManipulationDto),
    __metadata("design:type", NumberManipulationDto)
], ToGroupParamsDto.prototype, "numberManipulation", void 0);
class ToListParamsDto {
    numbers;
    timeout;
    options;
    rewrite;
}
exports.ToListParamsDto = ToListParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[^()?\[\]{}$\\";\n\r]*$/),
    __metadata("design:type", String)
], ToListParamsDto.prototype, "numbers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ToListParamsDto.prototype, "timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], ToListParamsDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DialTargetRewriteDto),
    __metadata("design:type", DialTargetRewriteDto)
], ToListParamsDto.prototype, "rewrite", void 0);
class ToIvrParamsDto {
    ivr_uid;
}
exports.ToIvrParamsDto = ToIvrParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ToIvrParamsDto.prototype, "ivr_uid", void 0);
class ToRouteParamsDto {
    context;
    extension;
    rewrite;
}
exports.ToRouteParamsDto = ToRouteParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], ToRouteParamsDto.prototype, "context", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => value_source_dto_1.ValueSourceDto),
    __metadata("design:type", value_source_dto_1.ValueSourceDto)
], ToRouteParamsDto.prototype, "extension", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DialTargetRewriteDto),
    __metadata("design:type", DialTargetRewriteDto)
], ToRouteParamsDto.prototype, "rewrite", void 0);
class OriginalCallerKeySourceDto {
    source;
}
__decorate([
    (0, class_validator_1.IsIn)(['original_caller']),
    __metadata("design:type", String)
], OriginalCallerKeySourceDto.prototype, "source", void 0);
class TrunkCallerIdDto {
    mode;
    value;
    directoryUid;
    valueFieldUid;
    keySource;
    onMissing;
    numbers;
    pick;
}
__decorate([
    (0, class_validator_1.IsIn)(['static', 'directory', 'pool']),
    __metadata("design:type", String)
], TrunkCallerIdDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], TrunkCallerIdDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.mode === 'directory'),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], TrunkCallerIdDto.prototype, "directoryUid", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.mode === 'directory'),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], TrunkCallerIdDto.prototype, "valueFieldUid", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.mode === 'directory'),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => OriginalCallerKeySourceDto),
    __metadata("design:type", OriginalCallerKeySourceDto)
], TrunkCallerIdDto.prototype, "keySource", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.mode === 'directory'),
    (0, class_validator_1.IsIn)(['keep_original']),
    __metadata("design:type", String)
], TrunkCallerIdDto.prototype, "onMissing", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.mode === 'pool'),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.Matches)(SAFE_DIAL, { each: true }),
    __metadata("design:type", Array)
], TrunkCallerIdDto.prototype, "numbers", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.mode === 'pool'),
    (0, class_validator_1.IsIn)(['random', 'round_robin']),
    __metadata("design:type", String)
], TrunkCallerIdDto.prototype, "pick", void 0);
class TrunkCarouselItemDto {
    trunkId;
    callerId;
    timeout;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], TrunkCarouselItemDto.prototype, "trunkId", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => TrunkCallerIdDto),
    __metadata("design:type", TrunkCallerIdDto)
], TrunkCarouselItemDto.prototype, "callerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], TrunkCarouselItemDto.prototype, "timeout", void 0);
class ToTrunkParamsDto {
    trunkMode;
    trunk;
    mode;
    trunks;
    cid_mode;
    callerid;
    callerId;
    dest;
    timeout;
    options;
    numberManipulation;
    rewrite;
}
exports.ToTrunkParamsDto = ToTrunkParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['single', 'carousel']),
    __metadata("design:type", String)
], ToTrunkParamsDto.prototype, "trunkMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], ToTrunkParamsDto.prototype, "trunk", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['random_then_failover', 'sequential']),
    __metadata("design:type", String)
], ToTrunkParamsDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TrunkCarouselItemDto),
    __metadata("design:type", Array)
], ToTrunkParamsDto.prototype, "trunks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['static']),
    __metadata("design:type", String)
], ToTrunkParamsDto.prototype, "cid_mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], ToTrunkParamsDto.prototype, "callerid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => TrunkCallerIdDto),
    __metadata("design:type", TrunkCallerIdDto)
], ToTrunkParamsDto.prototype, "callerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value == null || value === '')
            return undefined;
        return (0, shared_1.coerceDestValueSource)(value);
    }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => value_source_dto_1.ValueSourceDto),
    __metadata("design:type", value_source_dto_1.ValueSourceDto)
], ToTrunkParamsDto.prototype, "dest", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ToTrunkParamsDto.prototype, "timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], ToTrunkParamsDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => NumberManipulationDto),
    __metadata("design:type", NumberManipulationDto)
], ToTrunkParamsDto.prototype, "numberManipulation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DialTargetRewriteDto),
    __metadata("design:type", DialTargetRewriteDto)
], ToTrunkParamsDto.prototype, "rewrite", void 0);
/** Record() user flags. `k` is generator-only (D-56) — do not add it here. */
class RecordOptionsDto {
    q;
    o;
    x;
    y;
    n;
    s;
    u;
}
exports.RecordOptionsDto = RecordOptionsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RecordOptionsDto.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RecordOptionsDto.prototype, "o", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RecordOptionsDto.prototype, "x", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RecordOptionsDto.prototype, "y", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RecordOptionsDto.prototype, "n", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RecordOptionsDto.prototype, "s", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RecordOptionsDto.prototype, "u", void 0);
class VoicemailParamsDto {
    target;
    exten;
    greeting;
    max_duration;
    silence_timeout;
    record_options;
    notify;
    stt_engine_uid;
    llm_provider_uid;
}
exports.VoicemailParamsDto = VoicemailParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => value_source_dto_1.ValueSourceDto),
    __metadata("design:type", value_source_dto_1.ValueSourceDto)
], VoicemailParamsDto.prototype, "target", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], VoicemailParamsDto.prototype, "exten", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_GREETING),
    __metadata("design:type", String)
], VoicemailParamsDto.prototype, "greeting", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], VoicemailParamsDto.prototype, "max_duration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], VoicemailParamsDto.prototype, "silence_timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => RecordOptionsDto),
    __metadata("design:type", RecordOptionsDto)
], VoicemailParamsDto.prototype, "record_options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => integration_params_dto_1.NotifyParamsDto),
    __metadata("design:type", integration_params_dto_1.NotifyParamsDto)
], VoicemailParamsDto.prototype, "notify", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], VoicemailParamsDto.prototype, "stt_engine_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], VoicemailParamsDto.prototype, "llm_provider_uid", void 0);
//# sourceMappingURL=address.params.dto.js.map