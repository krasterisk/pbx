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
exports.UpdateAutodialContactDto = exports.CreateAutodialContactDto = exports.AutodialPhoneDraftDto = exports.UpdateAutodialBaseDto = exports.CreateAutodialBaseDto = exports.AutodialFieldDraftDto = exports.AUTODIAL_FIELD_KEY_PATTERN = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const shared_1 = require("@krasterisk/shared");
exports.AUTODIAL_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;
class AutodialFieldDraftDto {
    uid;
    key;
    label;
    type;
    required;
    position;
    is_phone;
    var_name;
    enum_values;
}
exports.AutodialFieldDraftDto = AutodialFieldDraftDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AutodialFieldDraftDto.prototype, "uid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.AUTODIAL_FIELD_KEY_PATTERN),
    __metadata("design:type", String)
], AutodialFieldDraftDto.prototype, "key", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], AutodialFieldDraftDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsIn)([...shared_1.AUTODIAL_FIELD_TYPES]),
    __metadata("design:type", String)
], AutodialFieldDraftDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AutodialFieldDraftDto.prototype, "required", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AutodialFieldDraftDto.prototype, "position", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AutodialFieldDraftDto.prototype, "is_phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AutodialFieldDraftDto.prototype, "var_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AutodialFieldDraftDto.prototype, "enum_values", void 0);
class CreateAutodialBaseDto {
    name;
    description;
    dedup_policy;
    phone_normalization;
    fields;
}
exports.CreateAutodialBaseDto = CreateAutodialBaseDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateAutodialBaseDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], CreateAutodialBaseDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...shared_1.AUTODIAL_DEDUP_POLICIES]),
    __metadata("design:type", String)
], CreateAutodialBaseDto.prototype, "dedup_policy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...shared_1.AUTODIAL_PHONE_NORMALIZATIONS]),
    __metadata("design:type", String)
], CreateAutodialBaseDto.prototype, "phone_normalization", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AutodialFieldDraftDto),
    __metadata("design:type", Array)
], CreateAutodialBaseDto.prototype, "fields", void 0);
class UpdateAutodialBaseDto {
    revision;
    name;
    description;
    dedup_policy;
    phone_normalization;
    fields;
}
exports.UpdateAutodialBaseDto = UpdateAutodialBaseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateAutodialBaseDto.prototype, "revision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateAutodialBaseDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], UpdateAutodialBaseDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...shared_1.AUTODIAL_DEDUP_POLICIES]),
    __metadata("design:type", String)
], UpdateAutodialBaseDto.prototype, "dedup_policy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...shared_1.AUTODIAL_PHONE_NORMALIZATIONS]),
    __metadata("design:type", String)
], UpdateAutodialBaseDto.prototype, "phone_normalization", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AutodialFieldDraftDto),
    __metadata("design:type", Array)
], UpdateAutodialBaseDto.prototype, "fields", void 0);
class AutodialPhoneDraftDto {
    uid;
    raw;
    is_primary;
    tz_offset_min;
}
exports.AutodialPhoneDraftDto = AutodialPhoneDraftDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AutodialPhoneDraftDto.prototype, "uid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AutodialPhoneDraftDto.prototype, "raw", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AutodialPhoneDraftDto.prototype, "is_primary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AutodialPhoneDraftDto.prototype, "tz_offset_min", void 0);
class CreateAutodialContactDto {
    external_id;
    /** Field values keyed by field.key */
    values;
    phones;
    comment;
}
exports.CreateAutodialContactDto = CreateAutodialContactDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", Object)
], CreateAutodialContactDto.prototype, "external_id", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateAutodialContactDto.prototype, "values", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AutodialPhoneDraftDto),
    __metadata("design:type", Array)
], CreateAutodialContactDto.prototype, "phones", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], CreateAutodialContactDto.prototype, "comment", void 0);
class UpdateAutodialContactDto {
    external_id;
    values;
    phones;
    comment;
}
exports.UpdateAutodialContactDto = UpdateAutodialContactDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", Object)
], UpdateAutodialContactDto.prototype, "external_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateAutodialContactDto.prototype, "values", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AutodialPhoneDraftDto),
    __metadata("design:type", Array)
], UpdateAutodialContactDto.prototype, "phones", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], UpdateAutodialContactDto.prototype, "comment", void 0);
//# sourceMappingURL=autodial-base.dto.js.map