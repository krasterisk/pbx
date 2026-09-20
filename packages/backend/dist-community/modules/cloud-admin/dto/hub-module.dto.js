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
exports.ReorderHubModulesDto = exports.ReplaceHubModulePagesDto = exports.HubModulePageItemDto = exports.UpdateHubModuleDto = exports.CreateHubModuleDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateHubModuleDto {
    code;
    name;
    kind;
    sort_order;
    requires_cloud;
}
exports.CreateHubModuleDto = CreateHubModuleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CreateHubModuleDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], CreateHubModuleDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['base', 'market']),
    __metadata("design:type", String)
], CreateHubModuleDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateHubModuleDto.prototype, "sort_order", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateHubModuleDto.prototype, "requires_cloud", void 0);
class UpdateHubModuleDto {
    name;
    kind;
    sort_order;
    requires_cloud;
}
exports.UpdateHubModuleDto = UpdateHubModuleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], UpdateHubModuleDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['base', 'market']),
    __metadata("design:type", String)
], UpdateHubModuleDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateHubModuleDto.prototype, "sort_order", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateHubModuleDto.prototype, "requires_cloud", void 0);
class HubModulePageItemDto {
    page_code;
    path;
    sort_order;
}
exports.HubModulePageItemDto = HubModulePageItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], HubModulePageItemDto.prototype, "page_code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", Object)
], HubModulePageItemDto.prototype, "path", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], HubModulePageItemDto.prototype, "sort_order", void 0);
class ReplaceHubModulePagesDto {
    pages;
}
exports.ReplaceHubModulePagesDto = ReplaceHubModulePagesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => HubModulePageItemDto),
    __metadata("design:type", Array)
], ReplaceHubModulePagesDto.prototype, "pages", void 0);
class ReorderHubModulesDto {
    codes;
}
exports.ReorderHubModulesDto = ReorderHubModulesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ReorderHubModulesDto.prototype, "codes", void 0);
//# sourceMappingURL=hub-module.dto.js.map