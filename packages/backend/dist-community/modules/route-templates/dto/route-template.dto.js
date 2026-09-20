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
exports.ApplyRouteTemplateDto = exports.UpdateRouteTemplateDto = exports.CreateRouteTemplateDto = exports.TemplateSlotDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const shared_1 = require("@krasterisk/shared");
class TemplateSlotDto {
    id;
    kind;
    label;
}
exports.TemplateSlotDto = TemplateSlotDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], TemplateSlotDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsIn)([...shared_1.TEMPLATE_SLOT_KINDS]),
    __metadata("design:type", String)
], TemplateSlotDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], TemplateSlotDto.prototype, "label", void 0);
class CreateRouteTemplateDto {
    name;
    description;
    actions;
    slots;
}
exports.CreateRouteTemplateDto = CreateRouteTemplateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateRouteTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], CreateRouteTemplateDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateRouteTemplateDto.prototype, "actions", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TemplateSlotDto),
    __metadata("design:type", Array)
], CreateRouteTemplateDto.prototype, "slots", void 0);
class UpdateRouteTemplateDto {
    name;
    description;
    actions;
    slots;
}
exports.UpdateRouteTemplateDto = UpdateRouteTemplateDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateRouteTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], UpdateRouteTemplateDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpdateRouteTemplateDto.prototype, "actions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TemplateSlotDto),
    __metadata("design:type", Array)
], UpdateRouteTemplateDto.prototype, "slots", void 0);
class ApplyRouteTemplateDto {
    slotValues;
    mode;
}
exports.ApplyRouteTemplateDto = ApplyRouteTemplateDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ApplyRouteTemplateDto.prototype, "slotValues", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['replace', 'append']),
    __metadata("design:type", String)
], ApplyRouteTemplateDto.prototype, "mode", void 0);
//# sourceMappingURL=route-template.dto.js.map