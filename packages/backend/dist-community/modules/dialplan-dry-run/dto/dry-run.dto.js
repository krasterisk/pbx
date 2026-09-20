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
exports.DryRunResultDto = exports.DryRunReaskDto = exports.DryRunRequestDto = void 0;
const class_validator_1 = require("class-validator");
class DryRunRequestDto {
    host;
    actions;
    menu_items;
    callerNumber;
    scenario;
    ivrChoice;
}
exports.DryRunRequestDto = DryRunRequestDto;
__decorate([
    (0, class_validator_1.IsIn)(['route', 'ivr']),
    __metadata("design:type", String)
], DryRunRequestDto.prototype, "host", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.Allow)(),
    __metadata("design:type", Array)
], DryRunRequestDto.prototype, "actions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.Allow)(),
    __metadata("design:type", Array)
], DryRunRequestDto.prototype, "menu_items", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DryRunRequestDto.prototype, "callerNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.Allow)(),
    __metadata("design:type", Object)
], DryRunRequestDto.prototype, "scenario", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DryRunRequestDto.prototype, "ivrChoice", void 0);
class DryRunReaskDto {
    source;
    keys;
    askedAfterRun;
    label;
}
exports.DryRunReaskDto = DryRunReaskDto;
class DryRunResultDto {
    segments;
    breadcrumbs;
    hopsUsed;
    hopLimit;
    outcome;
    reask;
    ivrInputs;
}
exports.DryRunResultDto = DryRunResultDto;
//# sourceMappingURL=dry-run.dto.js.map