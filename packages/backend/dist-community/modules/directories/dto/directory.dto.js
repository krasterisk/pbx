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
exports.RouteDirectoryBindingDto = exports.ImportDirectoryCsvDto = exports.UpdateDirectoryDto = exports.CreateDirectoryDto = exports.CallValueSourceDto = exports.IsCallValueSourceConstraint = exports.DirectoryBehaviorParamsDto = exports.DirectoryFieldMappingDto = exports.DirectoryRecordDto = exports.DirectoryFieldDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const shared_1 = require("@krasterisk/shared");
const FIELD_TYPES = ['string', 'phone', 'number', 'boolean'];
const MATCH_KINDS = ['exact', 'asterisk_pattern'];
const KEY_NORMALIZATIONS = [...shared_1.DIRECTORY_KEY_NORMALIZATIONS];
const MATCH_MODES = ['on_match', 'on_no_match'];
const BEHAVIOR_TYPES = [
    'set_name',
    'set_number',
    'drop',
    'redirect',
    'map_fields',
    'custom',
];
const CALL_VALUE_SOURCES = [
    'fixed',
    'route_pattern',
    'variable',
    'autodial_field',
    'original_caller',
    'current_caller',
];
class DirectoryFieldDto {
    key;
    label;
    type;
    required;
    position;
}
exports.DirectoryFieldDto = DirectoryFieldDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], DirectoryFieldDto.prototype, "key", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], DirectoryFieldDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsIn)(FIELD_TYPES),
    __metadata("design:type", String)
], DirectoryFieldDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DirectoryFieldDto.prototype, "required", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DirectoryFieldDto.prototype, "position", void 0);
class DirectoryRecordDto {
    /** Derived from a leading `_` on the lookup value. Accepted and ignored if sent. */
    match_kind;
    /** Unused for matching. Accepted and ignored if sent. */
    priority;
    values;
    comment;
}
exports.DirectoryRecordDto = DirectoryRecordDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(MATCH_KINDS),
    __metadata("design:type", String)
], DirectoryRecordDto.prototype, "match_kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DirectoryRecordDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], DirectoryRecordDto.prototype, "values", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], DirectoryRecordDto.prototype, "comment", void 0);
class DirectoryFieldMappingDto {
    fieldUid;
    targetVariable;
}
exports.DirectoryFieldMappingDto = DirectoryFieldMappingDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DirectoryFieldMappingDto.prototype, "fieldUid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], DirectoryFieldMappingDto.prototype, "targetVariable", void 0);
class DirectoryBehaviorParamsDto {
    fieldUid;
    fixed;
    fixedExten;
    targetContext;
    mappings;
}
exports.DirectoryBehaviorParamsDto = DirectoryBehaviorParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DirectoryBehaviorParamsDto.prototype, "fieldUid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DirectoryBehaviorParamsDto.prototype, "fixed", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DirectoryBehaviorParamsDto.prototype, "fixedExten", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DirectoryBehaviorParamsDto.prototype, "targetContext", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DirectoryFieldMappingDto),
    __metadata("design:type", Array)
], DirectoryBehaviorParamsDto.prototype, "mappings", void 0);
let IsCallValueSourceConstraint = class IsCallValueSourceConstraint {
    validate(value) {
        if (!value || typeof value !== 'object')
            return false;
        const src = value;
        if (!CALL_VALUE_SOURCES.includes(src.source)) {
            return false;
        }
        if (src.source === 'fixed') {
            return typeof src.value === 'string' && src.value.trim().length > 0 && src.name === undefined;
        }
        if (src.source === 'variable' || src.source === 'autodial_field') {
            return typeof src.name === 'string' && src.name.trim().length > 0 && src.value === undefined;
        }
        return src.value === undefined && src.name === undefined;
    }
    defaultMessage() {
        return 'key_source must be fixed (non-empty value), route_pattern, variable (non-empty name), autodial_field, original_caller, or current_caller';
    }
};
exports.IsCallValueSourceConstraint = IsCallValueSourceConstraint;
exports.IsCallValueSourceConstraint = IsCallValueSourceConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isCallValueSource', async: false })
], IsCallValueSourceConstraint);
class CallValueSourceDto {
    source;
    value;
    name;
}
exports.CallValueSourceDto = CallValueSourceDto;
__decorate([
    (0, class_validator_1.IsIn)(CALL_VALUE_SOURCES),
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
class CreateDirectoryDto {
    name;
    description;
    lookupFieldKey;
    key_normalization;
    fields;
    records;
}
exports.CreateDirectoryDto = CreateDirectoryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateDirectoryDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateDirectoryDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CreateDirectoryDto.prototype, "lookupFieldKey", void 0);
__decorate([
    (0, class_validator_1.IsIn)(KEY_NORMALIZATIONS),
    __metadata("design:type", String)
], CreateDirectoryDto.prototype, "key_normalization", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DirectoryFieldDto),
    __metadata("design:type", Array)
], CreateDirectoryDto.prototype, "fields", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DirectoryRecordDto),
    __metadata("design:type", Array)
], CreateDirectoryDto.prototype, "records", void 0);
class UpdateDirectoryDto {
    name;
    description;
    lookupFieldKey;
    key_normalization;
    fields;
    records;
}
exports.UpdateDirectoryDto = UpdateDirectoryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateDirectoryDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateDirectoryDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], UpdateDirectoryDto.prototype, "lookupFieldKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(KEY_NORMALIZATIONS),
    __metadata("design:type", String)
], UpdateDirectoryDto.prototype, "key_normalization", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DirectoryFieldDto),
    __metadata("design:type", Array)
], UpdateDirectoryDto.prototype, "fields", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DirectoryRecordDto),
    __metadata("design:type", Array)
], UpdateDirectoryDto.prototype, "records", void 0);
class ImportDirectoryCsvDto {
    csv;
}
exports.ImportDirectoryCsvDto = ImportDirectoryCsvDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(shared_1.DIRECTORY_CSV_MAX_BYTES),
    __metadata("design:type", String)
], ImportDirectoryCsvDto.prototype, "csv", void 0);
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
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], RouteDirectoryBindingDto.prototype, "directory_uid", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RouteDirectoryBindingDto.prototype, "position", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CallValueSourceDto),
    (0, class_validator_1.Validate)(IsCallValueSourceConstraint),
    __metadata("design:type", CallValueSourceDto)
], RouteDirectoryBindingDto.prototype, "key_source", void 0);
__decorate([
    (0, class_validator_1.IsIn)(MATCH_MODES),
    __metadata("design:type", String)
], RouteDirectoryBindingDto.prototype, "match_mode", void 0);
__decorate([
    (0, class_validator_1.IsIn)(BEHAVIOR_TYPES),
    __metadata("design:type", String)
], RouteDirectoryBindingDto.prototype, "behavior_type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DirectoryBehaviorParamsDto),
    __metadata("design:type", Object)
], RouteDirectoryBindingDto.prototype, "behavior_params", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    __metadata("design:type", Object)
], RouteDirectoryBindingDto.prototype, "actions", void 0);
//# sourceMappingURL=directory.dto.js.map