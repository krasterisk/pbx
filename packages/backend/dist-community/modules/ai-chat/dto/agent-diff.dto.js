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
exports.AgentDiffProposalDto = exports.AgentApplyPayloadDto = void 0;
exports.parseAgentDiffProposal = parseAgentDiffProposal;
exports.toProposalView = toProposalView;
exports.isAgentDiffProposal = isAgentDiffProposal;
exports.isProposalClientView = isProposalClientView;
exports.isWorkflowPlanView = isWorkflowPlanView;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class AgentApplyPayloadDto {
    tool;
    args;
    /** Adapter schema version stamped server-side; stale stored payloads refuse at confirm. */
    schemaVersion;
}
exports.AgentApplyPayloadDto = AgentApplyPayloadDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AgentApplyPayloadDto.prototype, "tool", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], AgentApplyPayloadDto.prototype, "args", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AgentApplyPayloadDto.prototype, "schemaVersion", void 0);
/**
 * Validated proposal accepted by createProposal.
 * Identifier is optional on input — the service generates it.
 */
class AgentDiffProposalDto {
    proposalId;
    entityType;
    entityLabel;
    summary;
    before;
    after;
    applyPayload;
    includesDialplanReload;
}
exports.AgentDiffProposalDto = AgentDiffProposalDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AgentDiffProposalDto.prototype, "proposalId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AgentDiffProposalDto.prototype, "entityType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AgentDiffProposalDto.prototype, "entityLabel", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AgentDiffProposalDto.prototype, "summary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], AgentDiffProposalDto.prototype, "before", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, value) => value !== null),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], AgentDiffProposalDto.prototype, "after", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AgentApplyPayloadDto),
    __metadata("design:type", AgentApplyPayloadDto)
], AgentDiffProposalDto.prototype, "applyPayload", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AgentDiffProposalDto.prototype, "includesDialplanReload", void 0);
function parseAgentDiffProposal(plain) {
    const dto = (0, class_transformer_1.plainToInstance)(AgentDiffProposalDto, plain);
    const errors = (0, class_validator_1.validateSync)(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) {
        throw new Error(`PROPOSAL_INVALID:${errors.map((error) => error.property).join(',')}`);
    }
    return dto;
}
function toProposalView(row) {
    return {
        proposalId: row.proposal_id,
        entityType: row.entity_type,
        entityLabel: row.entity_label,
        summary: row.summary,
        before: row.before_json,
        after: row.after_json,
        includesDialplanReload: row.includes_dialplan_reload,
        status: row.status,
        expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
        appliedAt: row.applied_at
            ? row.applied_at instanceof Date
                ? row.applied_at.toISOString()
                : String(row.applied_at)
            : null,
        error: row.error ?? null,
    };
}
function isAgentDiffProposal(value) {
    return (!!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'applyPayload' in value &&
        !!value.applyPayload);
}
function isProposalClientView(value) {
    return (!!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'proposalId' in value &&
        !('applyPayload' in value));
}
function isWorkflowPlanView(value) {
    return (!!value && typeof value === 'object' && !Array.isArray(value) &&
        'workflowId' in value && typeof value.workflowId === 'string' &&
        Array.isArray(value.steps));
}
//# sourceMappingURL=agent-diff.dto.js.map