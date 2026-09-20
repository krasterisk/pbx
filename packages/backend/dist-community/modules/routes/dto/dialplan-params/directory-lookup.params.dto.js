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
exports.DirectoryLookupParamsDto = exports.DirectoryLookupOutputDto = exports.validateAction = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const directory_lookup_dialplan_util_1 = require("../../../../shared/utils/directory-lookup-dialplan.util");
const value_source_dto_1 = require("./value-source.dto");
var directory_lookup_dialplan_util_2 = require("../../../../shared/utils/directory-lookup-dialplan.util");
Object.defineProperty(exports, "validateAction", { enumerable: true, get: function () { return directory_lookup_dialplan_util_2.validateAction; } });
let IsSafeTargetVariableConstraint = class IsSafeTargetVariableConstraint {
    validate(value) {
        return typeof value === 'string' && (0, directory_lookup_dialplan_util_1.validateAction)({ targetVariable: value }).length === 0;
    }
    defaultMessage() {
        return 'targetVariable must be an upper-case channel variable and must not be reserved';
    }
};
IsSafeTargetVariableConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isSafeTargetVariable', async: false })
], IsSafeTargetVariableConstraint);
class DirectoryLookupOutputDto {
    fieldUid;
    targetVariable;
}
exports.DirectoryLookupOutputDto = DirectoryLookupOutputDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DirectoryLookupOutputDto.prototype, "fieldUid", void 0);
__decorate([
    (0, class_validator_1.Validate)(IsSafeTargetVariableConstraint),
    __metadata("design:type", String)
], DirectoryLookupOutputDto.prototype, "targetVariable", void 0);
class DirectoryLookupParamsDto {
    directoryUid;
    keySource;
    outputs;
    onMissing;
}
exports.DirectoryLookupParamsDto = DirectoryLookupParamsDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DirectoryLookupParamsDto.prototype, "directoryUid", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => value_source_dto_1.CallValueSourceDto),
    __metadata("design:type", value_source_dto_1.CallValueSourceDto)
], DirectoryLookupParamsDto.prototype, "keySource", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DirectoryLookupOutputDto),
    __metadata("design:type", Array)
], DirectoryLookupParamsDto.prototype, "outputs", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['keep', 'empty']),
    __metadata("design:type", String)
], DirectoryLookupParamsDto.prototype, "onMissing", void 0);
//# sourceMappingURL=directory-lookup.params.dto.js.map