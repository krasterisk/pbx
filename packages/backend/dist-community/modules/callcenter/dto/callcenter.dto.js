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
exports.UpdatePauseReasonDto = exports.CreatePauseReasonDto = exports.SupervisorStartShiftDto = exports.SupervisorWatchedAgentsDto = exports.SupervisorHangupCallDto = exports.SupervisorRedirectCallDto = exports.SupervisorForceLogoutDto = exports.SupervisorQueuePenaltyDto = exports.SupervisorQueueActionDto = exports.SupervisorForceActionDto = exports.SupervisorSpyDto = exports.TransferDto = exports.MarkMissedCalledBackDto = exports.WrapupExtendDto = exports.PickCallDto = exports.AgentHangupDto = exports.AgentUnpauseDto = exports.AgentPauseDto = exports.AgentLoginDto = void 0;
/**
 * CallCenter DTO classes with class-validator decorators.
 * Used by NestJS ValidationPipe for automatic request body validation.
 */
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
// ─── Agent DTOs ────────────────────────────────────────────
class AgentLoginDto {
    /** Agent SIP interface, e.g. "PJSIP/e101_42" */
    interface;
    /** Queue names to join on login */
    queues;
}
exports.AgentLoginDto = AgentLoginDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AgentLoginDto.prototype, "interface", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AgentLoginDto.prototype, "queues", void 0);
class AgentPauseDto {
    reason;
    /** Pause in all queues or specific queue */
    queue;
}
exports.AgentPauseDto = AgentPauseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], AgentPauseDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AgentPauseDto.prototype, "queue", void 0);
class AgentUnpauseDto {
    queue;
}
exports.AgentUnpauseDto = AgentUnpauseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AgentUnpauseDto.prototype, "queue", void 0);
class AgentHangupDto {
    channel;
}
exports.AgentHangupDto = AgentHangupDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AgentHangupDto.prototype, "channel", void 0);
class PickCallDto {
    /** uniqueid of the waiting call to pick up */
    uniqueid;
}
exports.PickCallDto = PickCallDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], PickCallDto.prototype, "uniqueid", void 0);
class WrapupExtendDto {
    /** Optional override seconds to extend (defaults to operator wrapup_extend_step) */
    seconds;
}
exports.WrapupExtendDto = WrapupExtendDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(600),
    __metadata("design:type", Number)
], WrapupExtendDto.prototype, "seconds", void 0);
class MarkMissedCalledBackDto {
    note;
}
exports.MarkMissedCalledBackDto = MarkMissedCalledBackDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], MarkMissedCalledBackDto.prototype, "note", void 0);
class TransferDto {
    /** Call uniqueid to transfer */
    uniqueid;
    /** Target: extension, queue name, or agent interface */
    target;
    /** Transfer type */
    type;
}
exports.TransferDto = TransferDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TransferDto.prototype, "uniqueid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], TransferDto.prototype, "target", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['blind', 'attended']),
    __metadata("design:type", String)
], TransferDto.prototype, "type", void 0);
// ─── Supervisor DTOs ───────────────────────────────────────
class SupervisorSpyDto {
    agentInterface;
    mode;
}
exports.SupervisorSpyDto = SupervisorSpyDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SupervisorSpyDto.prototype, "agentInterface", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['spy', 'whisper', 'barge']),
    __metadata("design:type", String)
], SupervisorSpyDto.prototype, "mode", void 0);
class SupervisorForceActionDto {
    agentInterface;
    reason;
}
exports.SupervisorForceActionDto = SupervisorForceActionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SupervisorForceActionDto.prototype, "agentInterface", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], SupervisorForceActionDto.prototype, "reason", void 0);
class SupervisorQueueActionDto {
    agentInterface;
    queue;
    penalty;
}
exports.SupervisorQueueActionDto = SupervisorQueueActionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SupervisorQueueActionDto.prototype, "agentInterface", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SupervisorQueueActionDto.prototype, "queue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SupervisorQueueActionDto.prototype, "penalty", void 0);
class SupervisorQueuePenaltyDto {
    agentInterface;
    queue;
    penalty;
}
exports.SupervisorQueuePenaltyDto = SupervisorQueuePenaltyDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SupervisorQueuePenaltyDto.prototype, "agentInterface", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SupervisorQueuePenaltyDto.prototype, "queue", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SupervisorQueuePenaltyDto.prototype, "penalty", void 0);
class SupervisorForceLogoutDto {
    agentInterface;
}
exports.SupervisorForceLogoutDto = SupervisorForceLogoutDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SupervisorForceLogoutDto.prototype, "agentInterface", void 0);
class SupervisorRedirectCallDto {
    uniqueid;
    target;
}
exports.SupervisorRedirectCallDto = SupervisorRedirectCallDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SupervisorRedirectCallDto.prototype, "uniqueid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SupervisorRedirectCallDto.prototype, "target", void 0);
class SupervisorHangupCallDto {
    uniqueid;
}
exports.SupervisorHangupCallDto = SupervisorHangupCallDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SupervisorHangupCallDto.prototype, "uniqueid", void 0);
class SupervisorWatchedAgentsDto {
    userIds;
    /** @deprecated legacy extension list — mapped to user ids on the server. */
    extens;
}
exports.SupervisorWatchedAgentsDto = SupervisorWatchedAgentsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)({ each: true }),
    __metadata("design:type", Array)
], SupervisorWatchedAgentsDto.prototype, "userIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], SupervisorWatchedAgentsDto.prototype, "extens", void 0);
class SupervisorStartShiftDto {
    operatorUserId;
    interface;
    queues;
}
exports.SupervisorStartShiftDto = SupervisorStartShiftDto;
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], SupervisorStartShiftDto.prototype, "operatorUserId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SupervisorStartShiftDto.prototype, "interface", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], SupervisorStartShiftDto.prototype, "queues", void 0);
// ─── Pause Reason DTOs ─────────────────────────────────────
class CreatePauseReasonDto {
    name;
    color;
    max_duration;
    is_paid;
    sort_order;
}
exports.CreatePauseReasonDto = CreatePauseReasonDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], CreatePauseReasonDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(7),
    __metadata("design:type", String)
], CreatePauseReasonDto.prototype, "color", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreatePauseReasonDto.prototype, "max_duration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreatePauseReasonDto.prototype, "is_paid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreatePauseReasonDto.prototype, "sort_order", void 0);
class UpdatePauseReasonDto {
    name;
    color;
    max_duration;
    is_paid;
    sort_order;
}
exports.UpdatePauseReasonDto = UpdatePauseReasonDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], UpdatePauseReasonDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(7),
    __metadata("design:type", String)
], UpdatePauseReasonDto.prototype, "color", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdatePauseReasonDto.prototype, "max_duration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdatePauseReasonDto.prototype, "is_paid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdatePauseReasonDto.prototype, "sort_order", void 0);
//# sourceMappingURL=callcenter.dto.js.map