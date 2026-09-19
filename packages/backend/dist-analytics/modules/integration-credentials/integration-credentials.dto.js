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
exports.RotateIntegrationBody = exports.ReplaceIntegrationGrantsBody = exports.IntegrationGrantBody = exports.CreateIntegrationBody = exports.IntegrationListQuery = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class IntegrationListQuery {
    limit;
    cursor;
}
exports.IntegrationListQuery = IntegrationListQuery;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 1, maximum: 100, default: 50 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], IntegrationListQuery.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], IntegrationListQuery.prototype, "cursor", void 0);
class CreateIntegrationBody {
    label;
    product;
    operationId;
    expiresAt;
}
exports.CreateIntegrationBody = CreateIntegrationBody;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 120 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateIntegrationBody.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['speech_analytics', 'ai_voice_robots'] }),
    (0, class_validator_1.IsIn)(['speech_analytics', 'ai_voice_robots']),
    __metadata("design:type", String)
], CreateIntegrationBody.prototype, "product", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateIntegrationBody.prototype, "operationId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'date-time', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)({ strict: true }),
    __metadata("design:type", Object)
], CreateIntegrationBody.prototype, "expiresAt", void 0);
class IntegrationGrantBody {
    resourceKind;
    resourceId;
    scope;
}
exports.IntegrationGrantBody = IntegrationGrantBody;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['project', 'deployment'] }),
    (0, class_validator_1.IsIn)(['project', 'deployment']),
    __metadata("design:type", String)
], IntegrationGrantBody.prototype, "resourceKind", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], IntegrationGrantBody.prototype, "resourceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], IntegrationGrantBody.prototype, "scope", void 0);
class ReplaceIntegrationGrantsBody {
    expectedRevision;
    grants;
}
exports.ReplaceIntegrationGrantsBody = ReplaceIntegrationGrantsBody;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReplaceIntegrationGrantsBody.prototype, "expectedRevision", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [IntegrationGrantBody], maxItems: 100 }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => IntegrationGrantBody),
    __metadata("design:type", Array)
], ReplaceIntegrationGrantsBody.prototype, "grants", void 0);
class RotateIntegrationBody {
    operationId;
    expectedGeneration;
}
exports.RotateIntegrationBody = RotateIntegrationBody;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RotateIntegrationBody.prototype, "operationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], RotateIntegrationBody.prototype, "expectedGeneration", void 0);
//# sourceMappingURL=integration-credentials.dto.js.map