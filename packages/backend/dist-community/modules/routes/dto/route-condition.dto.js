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
exports.RouteConditionDto = exports.CONDITION_SOURCE_DTO = exports.IsDialstatusOrArrayConstraint = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const shared_1 = require("@krasterisk/shared");
const ValidDialstatuses = ['', ...shared_1.DIALSTATUS_VALUES];
const sourceErrors = new WeakMap();
let IsDialstatusOrArrayConstraint = class IsDialstatusOrArrayConstraint {
    validate(value) {
        if (value === undefined || value === null)
            return true;
        if (typeof value === 'string')
            return ValidDialstatuses.includes(value);
        if (Array.isArray(value)) {
            return value.every((item) => typeof item === 'string' && ValidDialstatuses.includes(item));
        }
        return false;
    }
    defaultMessage() {
        return 'dialstatus must be a valid status or array of valid statuses';
    }
};
exports.IsDialstatusOrArrayConstraint = IsDialstatusOrArrayConstraint;
exports.IsDialstatusOrArrayConstraint = IsDialstatusOrArrayConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isDialstatusOrArray', async: false })
], IsDialstatusOrArrayConstraint);
class DialstatusSourceDto {
    source;
    values;
    dialstatus;
}
__decorate([
    (0, class_validator_1.IsIn)(['dialstatus']),
    __metadata("design:type", String)
], DialstatusSourceDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Validate)(IsDialstatusOrArrayConstraint),
    __metadata("design:type", Object)
], DialstatusSourceDto.prototype, "values", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Validate)(IsDialstatusOrArrayConstraint),
    __metadata("design:type", Object)
], DialstatusSourceDto.prototype, "dialstatus", void 0);
class QueuestatusSourceDto {
    source;
    values;
}
__decorate([
    (0, class_validator_1.IsIn)(['queuestatus']),
    __metadata("design:type", String)
], QueuestatusSourceDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)([...shared_1.QUEUESTATUS_VALUES], { each: true }),
    __metadata("design:type", Array)
], QueuestatusSourceDto.prototype, "values", void 0);
class DeviceStateSourceDto {
    source;
    device;
    values;
}
__decorate([
    (0, class_validator_1.IsIn)(['device_state']),
    __metadata("design:type", String)
], DeviceStateSourceDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.Matches)(shared_1.CONDITION_DEVICE_RE),
    __metadata("design:type", String)
], DeviceStateSourceDto.prototype, "device", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)([...shared_1.DEVICE_STATE_VALUES], { each: true }),
    __metadata("design:type", Array)
], DeviceStateSourceDto.prototype, "values", void 0);
class VariableSourceDto {
    source;
    name;
    op;
    value;
}
__decorate([
    (0, class_validator_1.IsIn)(['variable']),
    __metadata("design:type", String)
], VariableSourceDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.Matches)(shared_1.CONDITION_VAR_NAME_RE),
    __metadata("design:type", String)
], VariableSourceDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsIn)([...shared_1.CONDITION_OPS]),
    __metadata("design:type", String)
], VariableSourceDto.prototype, "op", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], VariableSourceDto.prototype, "value", void 0);
class HttpResultSourceDto {
    source;
    op;
    value;
}
__decorate([
    (0, class_validator_1.IsIn)(['http_result']),
    __metadata("design:type", String)
], HttpResultSourceDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsIn)([...shared_1.CONDITION_OPS]),
    __metadata("design:type", String)
], HttpResultSourceDto.prototype, "op", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HttpResultSourceDto.prototype, "value", void 0);
class RecordStatusSourceDto {
    source;
    values;
}
__decorate([
    (0, class_validator_1.IsIn)(['record_status']),
    __metadata("design:type", String)
], RecordStatusSourceDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)([...shared_1.RECORD_STATUS_VALUES], { each: true }),
    __metadata("design:type", Array)
], RecordStatusSourceDto.prototype, "values", void 0);
/** ACTION_PARAM_DTO-style registry: one DTO per ConditionSource (12-03 form). */
exports.CONDITION_SOURCE_DTO = {
    dialstatus: DialstatusSourceDto,
    queuestatus: QueuestatusSourceDto,
    device_state: DeviceStateSourceDto,
    variable: VariableSourceDto,
    http_result: HttpResultSourceDto,
    record_status: RecordStatusSourceDto,
};
let IsTypedConditionSourceConstraint = class IsTypedConditionSourceConstraint {
    validate(_value, args) {
        const obj = args.object;
        if (!obj.source)
            return true;
        if (!Object.prototype.hasOwnProperty.call(exports.CONDITION_SOURCE_DTO, obj.source)) {
            return false;
        }
        const DtoClass = exports.CONDITION_SOURCE_DTO[obj.source];
        const dto = (0, class_transformer_1.plainToInstance)(DtoClass, obj);
        const errors = (0, class_validator_1.validateSync)(dto);
        sourceErrors.set(obj, errors);
        return errors.length === 0;
    }
    defaultMessage(args) {
        const nested = sourceErrors.get(args.object) ?? [];
        if (nested.length) {
            return nested
                .flatMap((err) => Object.values(err.constraints ?? {}))
                .filter(Boolean)
                .join('; ') || 'condition source is invalid';
        }
        return 'condition source is invalid';
    }
};
IsTypedConditionSourceConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isTypedConditionSource', async: false })
], IsTypedConditionSourceConstraint);
class RouteConditionDto {
    source;
    values;
    dialstatus;
    device;
    name;
    op;
    value;
}
exports.RouteConditionDto = RouteConditionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...shared_1.CONDITION_SOURCES]),
    (0, class_validator_1.Validate)(IsTypedConditionSourceConstraint),
    __metadata("design:type", String)
], RouteConditionDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => !o.source || o.source === 'dialstatus'),
    (0, class_validator_1.Validate)(IsDialstatusOrArrayConstraint),
    __metadata("design:type", Object)
], RouteConditionDto.prototype, "values", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => !o.source || o.source === 'dialstatus'),
    (0, class_validator_1.Validate)(IsDialstatusOrArrayConstraint),
    __metadata("design:type", Object)
], RouteConditionDto.prototype, "dialstatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RouteConditionDto.prototype, "device", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RouteConditionDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RouteConditionDto.prototype, "op", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RouteConditionDto.prototype, "value", void 0);
//# sourceMappingURL=route-condition.dto.js.map