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
exports.ValueSourceDto = exports.CallValueSourceDto = exports.IsQueuePrioritySourceConstraint = exports.IsValueSourceConstraint = exports.PRIORITY_SOURCES = exports.VALUE_SOURCES = exports.CALL_VALUE_SOURCES = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
exports.CALL_VALUE_SOURCES = [
    'fixed',
    'route_pattern',
    'variable',
    'autodial_field',
    'original_caller',
    'current_caller',
];
exports.VALUE_SOURCES = [...exports.CALL_VALUE_SOURCES, 'directory'];
exports.PRIORITY_SOURCES = ['fixed', 'variable', 'directory'];
const ON_MISSING = ['keep', 'empty', 'skip'];
function isCallValueSource(value) {
    if (!value || typeof value !== 'object')
        return false;
    const src = value;
    if (!exports.CALL_VALUE_SOURCES.includes(src.source)) {
        return false;
    }
    if (src.source === 'fixed') {
        return typeof src.value === 'string' && src.value.trim().length > 0;
    }
    if (src.source === 'variable' || src.source === 'autodial_field') {
        return typeof src.name === 'string' && src.name.trim().length > 0;
    }
    return true;
}
function isDirectorySource(src) {
    return (Number.isInteger(src.directoryUid) &&
        Number(src.directoryUid) > 0 &&
        Number.isInteger(src.valueFieldUid) &&
        Number(src.valueFieldUid) > 0 &&
        ON_MISSING.includes(src.onMissing) &&
        isCallValueSource(src.keySource));
}
let IsValueSourceConstraint = class IsValueSourceConstraint {
    validate(value) {
        if (!value || typeof value !== 'object')
            return false;
        const src = value;
        if (!exports.VALUE_SOURCES.includes(src.source))
            return false;
        if (src.source === 'fixed') {
            return typeof src.value === 'string' && src.value.trim().length > 0;
        }
        if (src.source === 'variable' || src.source === 'autodial_field') {
            return typeof src.name === 'string' && src.name.trim().length > 0;
        }
        if (src.source === 'directory') {
            return isDirectorySource(src);
        }
        return true;
    }
    defaultMessage() {
        return 'target.source must be fixed, route_pattern, variable, autodial_field, original_caller, current_caller, or directory; directory requires directoryUid, keySource, valueFieldUid, and onMissing';
    }
};
exports.IsValueSourceConstraint = IsValueSourceConstraint;
exports.IsValueSourceConstraint = IsValueSourceConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isValueSource', async: false })
], IsValueSourceConstraint);
/** Queue priority ValueSource: no route_pattern; fixed must be integer 0..20. */
let IsQueuePrioritySourceConstraint = class IsQueuePrioritySourceConstraint {
    validate(value) {
        if (!value || typeof value !== 'object')
            return false;
        const src = value;
        if (!exports.PRIORITY_SOURCES.includes(src.source))
            return false;
        if (src.source === 'fixed') {
            if (typeof src.value !== 'string' || !src.value.trim())
                return false;
            const n = Number(src.value);
            return Number.isInteger(n) && n >= 0 && n <= 20;
        }
        if (src.source === 'variable') {
            return typeof src.name === 'string' && src.name.trim().length > 0;
        }
        return isDirectorySource(src);
    }
    defaultMessage() {
        return 'priority must be fixed (0-20), variable, or directory';
    }
};
exports.IsQueuePrioritySourceConstraint = IsQueuePrioritySourceConstraint;
exports.IsQueuePrioritySourceConstraint = IsQueuePrioritySourceConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isQueuePrioritySource', async: false })
], IsQueuePrioritySourceConstraint);
class CallValueSourceDto {
    source;
    value;
    name;
}
exports.CallValueSourceDto = CallValueSourceDto;
__decorate([
    (0, class_validator_1.IsIn)(exports.CALL_VALUE_SOURCES),
    __metadata("design:type", Object)
], CallValueSourceDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.source === 'fixed'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CallValueSourceDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.source === 'variable' || o.source === 'autodial_field'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CallValueSourceDto.prototype, "name", void 0);
class ValueSourceDto {
    source;
    value;
    name;
    directoryUid;
    keySource;
    valueFieldUid;
    onMissing;
}
exports.ValueSourceDto = ValueSourceDto;
__decorate([
    (0, class_validator_1.IsIn)(exports.VALUE_SOURCES),
    __metadata("design:type", Object)
], ValueSourceDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.source === 'fixed'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ValueSourceDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.source === 'variable' || o.source === 'autodial_field'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ValueSourceDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.source === 'directory'),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ValueSourceDto.prototype, "directoryUid", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.source === 'directory'),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CallValueSourceDto),
    __metadata("design:type", CallValueSourceDto)
], ValueSourceDto.prototype, "keySource", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.source === 'directory'),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ValueSourceDto.prototype, "valueFieldUid", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.source === 'directory'),
    (0, class_validator_1.IsIn)(ON_MISSING),
    __metadata("design:type", Object)
], ValueSourceDto.prototype, "onMissing", void 0);
//# sourceMappingURL=value-source.dto.js.map