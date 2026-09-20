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
exports.AutodialImportUploadDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class AutodialColumnMapDto {
    column;
    column_index;
    field_key;
    transform;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], AutodialColumnMapDto.prototype, "column", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AutodialColumnMapDto.prototype, "column_index", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AutodialColumnMapDto.prototype, "field_key", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['trim', 'phone_normalize', 'date_iso', 'money_cents', 'none']),
    __metadata("design:type", Object)
], AutodialColumnMapDto.prototype, "transform", void 0);
class AutodialImportUploadDto {
    filename;
    source;
    content_base64;
    profile_uid;
    column_map;
    delimiter;
    has_header;
    dedup_policy;
    replace;
    expected_revision;
}
exports.AutodialImportUploadDto = AutodialImportUploadDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], AutodialImportUploadDto.prototype, "filename", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['csv', 'xlsx']),
    __metadata("design:type", String)
], AutodialImportUploadDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(Math.ceil(20 * 1024 * 1024 / 3) * 4),
    (0, class_validator_1.IsBase64)(),
    __metadata("design:type", String)
], AutodialImportUploadDto.prototype, "content_base64", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AutodialImportUploadDto.prototype, "profile_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AutodialColumnMapDto),
    __metadata("design:type", Array)
], AutodialImportUploadDto.prototype, "column_map", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['', ',', ';', '\t', '|']),
    __metadata("design:type", String)
], AutodialImportUploadDto.prototype, "delimiter", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AutodialImportUploadDto.prototype, "has_header", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['phone', 'external_id', 'none']),
    __metadata("design:type", String)
], AutodialImportUploadDto.prototype, "dedup_policy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AutodialImportUploadDto.prototype, "replace", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AutodialImportUploadDto.prototype, "expected_revision", void 0);
//# sourceMappingURL=autodial-import.dto.js.map