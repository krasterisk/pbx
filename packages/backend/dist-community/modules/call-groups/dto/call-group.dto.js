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
exports.UpdateCallGroupDto = exports.CreateCallGroupDto = exports.CallGroupMemberDto = exports.IsDialOptionsConstraint = exports.CALL_GROUP_CONFIRM_DIGIT_PATTERN = exports.CALL_GROUP_MEDIA_ID_PATTERN = exports.CALL_GROUP_EXTEN_PATTERN = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const dialplan_options_util_1 = require("../../../shared/utils/dialplan-options.util");
/** 2–8 digits — same envelope as queue/internal numbers (T-12-14-02) */
exports.CALL_GROUP_EXTEN_PATTERN = /^\d{2,8}$/;
/** Prompt / MOH class identifiers — no path separators (T-12-15-03) */
exports.CALL_GROUP_MEDIA_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
/** Single DTMF key for external answer confirmation */
exports.CALL_GROUP_CONFIRM_DIGIT_PATTERN = /^[0-9*#]$/;
function optionsBalanced(input) {
    let depth = 0;
    for (const ch of input) {
        if (ch === '(')
            depth += 1;
        else if (ch === ')') {
            depth -= 1;
            if (depth < 0)
                return false;
        }
    }
    return depth === 0;
}
let IsDialOptionsConstraint = class IsDialOptionsConstraint {
    validate(value) {
        if (typeof value !== 'string')
            return false;
        if (!optionsBalanced(value))
            return false;
        if (/[;$\n\r\\]/.test(value))
            return false;
        try {
            return (0, dialplan_options_util_1.serializeOptions)((0, dialplan_options_util_1.parseOptions)(value)) === value;
        }
        catch {
            return false;
        }
    }
    defaultMessage() {
        return 'dialOptions must be a balanced Dial() options string';
    }
};
exports.IsDialOptionsConstraint = IsDialOptionsConstraint;
exports.IsDialOptionsConstraint = IsDialOptionsConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isDialOptions', async: false })
], IsDialOptionsConstraint);
class CallGroupMemberDto {
    member_type;
    value;
    position;
    ring_time;
}
exports.CallGroupMemberDto = CallGroupMemberDto;
__decorate([
    (0, class_validator_1.IsIn)(['internal', 'external']),
    __metadata("design:type", String)
], CallGroupMemberDto.prototype, "member_type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CallGroupMemberDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CallGroupMemberDto.prototype, "position", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CallGroupMemberDto.prototype, "ring_time", void 0);
class CreateCallGroupDto {
    name;
    exten;
    strategy;
    ring_time;
    external_context;
    cid_prefix;
    confirmExternal;
    confirmDigit;
    skipBusy;
    greetingPrompt;
    mohClass;
    useMohInsteadOfRingback;
    dialOptions;
    members;
}
exports.CreateCallGroupDto = CreateCallGroupDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCallGroupDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.CALL_GROUP_EXTEN_PATTERN, { message: 'exten must be 2-8 digits' }),
    __metadata("design:type", String)
], CreateCallGroupDto.prototype, "exten", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['ringall', 'hunt', 'memoryhunt', 'random']),
    __metadata("design:type", String)
], CreateCallGroupDto.prototype, "strategy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateCallGroupDto.prototype, "ring_time", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCallGroupDto.prototype, "external_context", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCallGroupDto.prototype, "cid_prefix", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCallGroupDto.prototype, "confirmExternal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.CALL_GROUP_CONFIRM_DIGIT_PATTERN, { message: 'confirmDigit must be a single DTMF key (0-9, *, #)' }),
    __metadata("design:type", String)
], CreateCallGroupDto.prototype, "confirmDigit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCallGroupDto.prototype, "skipBusy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.CALL_GROUP_MEDIA_ID_PATTERN, { message: 'greetingPrompt must be a media identifier' }),
    __metadata("design:type", String)
], CreateCallGroupDto.prototype, "greetingPrompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.CALL_GROUP_MEDIA_ID_PATTERN, { message: 'mohClass must be a media identifier' }),
    __metadata("design:type", String)
], CreateCallGroupDto.prototype, "mohClass", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCallGroupDto.prototype, "useMohInsteadOfRingback", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Validate)(IsDialOptionsConstraint),
    __metadata("design:type", String)
], CreateCallGroupDto.prototype, "dialOptions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CallGroupMemberDto),
    __metadata("design:type", Array)
], CreateCallGroupDto.prototype, "members", void 0);
class UpdateCallGroupDto {
    name;
    exten;
    strategy;
    ring_time;
    external_context;
    cid_prefix;
    confirmExternal;
    confirmDigit;
    skipBusy;
    greetingPrompt;
    mohClass;
    useMohInsteadOfRingback;
    dialOptions;
    members;
}
exports.UpdateCallGroupDto = UpdateCallGroupDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCallGroupDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.CALL_GROUP_EXTEN_PATTERN, { message: 'exten must be 2-8 digits' }),
    __metadata("design:type", String)
], UpdateCallGroupDto.prototype, "exten", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ringall', 'hunt', 'memoryhunt', 'random']),
    __metadata("design:type", String)
], UpdateCallGroupDto.prototype, "strategy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateCallGroupDto.prototype, "ring_time", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCallGroupDto.prototype, "external_context", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCallGroupDto.prototype, "cid_prefix", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCallGroupDto.prototype, "confirmExternal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.CALL_GROUP_CONFIRM_DIGIT_PATTERN, { message: 'confirmDigit must be a single DTMF key (0-9, *, #)' }),
    __metadata("design:type", String)
], UpdateCallGroupDto.prototype, "confirmDigit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCallGroupDto.prototype, "skipBusy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.CALL_GROUP_MEDIA_ID_PATTERN, { message: 'greetingPrompt must be a media identifier' }),
    __metadata("design:type", String)
], UpdateCallGroupDto.prototype, "greetingPrompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.CALL_GROUP_MEDIA_ID_PATTERN, { message: 'mohClass must be a media identifier' }),
    __metadata("design:type", String)
], UpdateCallGroupDto.prototype, "mohClass", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCallGroupDto.prototype, "useMohInsteadOfRingback", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Validate)(IsDialOptionsConstraint),
    __metadata("design:type", String)
], UpdateCallGroupDto.prototype, "dialOptions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CallGroupMemberDto),
    __metadata("design:type", Array)
], UpdateCallGroupDto.prototype, "members", void 0);
//# sourceMappingURL=call-group.dto.js.map