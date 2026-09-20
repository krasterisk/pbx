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
exports.WebhookParamsDto = exports.CmdParamsDto = exports.ScheduleParamsDto = exports.TimeGroupIntervalDto = exports.HangupParamsDto = exports.GotoParamsDto = exports.LabelParamsDto = exports.CallerIdParamsDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const route_condition_dto_1 = require("../route-condition.dto");
const value_source_dto_1 = require("./value-source.dto");
const SAFE_DIAL = /^[^(),?\[\]{}$\\";\n\r]*$/;
const SAFE_TEXT = /^[^\n\r;]*$/;
const CALLERID_MODES = ['static', 'directory', 'number_list', 'carousel'];
const HANGUP_SIGNALS = ['busy', 'congestion', 'hangup'];
const CALLERID_ON_MISSING = ['keep', 'empty', 'skip'];
class CallerIdParamsDto {
    mode;
    callerid;
    name;
    directoryUid;
    valueFieldUid;
    keySource;
    onMissing;
    phonebook_uid;
    list_uid;
    pool;
}
exports.CallerIdParamsDto = CallerIdParamsDto;
__decorate([
    (0, class_validator_1.IsIn)(CALLERID_MODES),
    __metadata("design:type", String)
], CallerIdParamsDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], CallerIdParamsDto.prototype, "callerid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], CallerIdParamsDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.mode === 'directory'),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CallerIdParamsDto.prototype, "directoryUid", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.mode === 'directory'),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CallerIdParamsDto.prototype, "valueFieldUid", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.mode === 'directory'),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => value_source_dto_1.CallValueSourceDto),
    __metadata("design:type", value_source_dto_1.CallValueSourceDto)
], CallerIdParamsDto.prototype, "keySource", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.mode === 'directory'),
    (0, class_validator_1.IsIn)(CALLERID_ON_MISSING),
    __metadata("design:type", Object)
], CallerIdParamsDto.prototype, "onMissing", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((_, value) => value !== undefined),
    (0, class_validator_1.Equals)(undefined, { message: 'phonebook_uid is not allowed' }),
    __metadata("design:type", void 0)
], CallerIdParamsDto.prototype, "phonebook_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CallerIdParamsDto.prototype, "list_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CallerIdParamsDto.prototype, "pool", void 0);
class LabelParamsDto {
    label_name;
}
exports.LabelParamsDto = LabelParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], LabelParamsDto.prototype, "label_name", void 0);
/**
 * Unified jump: without `condition` it is a plain Goto, with `condition` it is
 * a two-way branch and `false_label` is the else-target.
 */
class GotoParamsDto {
    label_name;
    condition;
    false_label;
}
exports.GotoParamsDto = GotoParamsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], GotoParamsDto.prototype, "label_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => route_condition_dto_1.RouteConditionDto),
    __metadata("design:type", route_condition_dto_1.RouteConditionDto)
], GotoParamsDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.Matches)(SAFE_DIAL),
    __metadata("design:type", String)
], GotoParamsDto.prototype, "false_label", void 0);
class HangupParamsDto {
    signal;
    timeout;
    causecode;
}
exports.HangupParamsDto = HangupParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(HANGUP_SIGNALS),
    __metadata("design:type", String)
], HangupParamsDto.prototype, "signal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], HangupParamsDto.prototype, "timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{1,3}$/),
    __metadata("design:type", String)
], HangupParamsDto.prototype, "causecode", void 0);
class TimeGroupIntervalDto {
    time_start;
    time_end;
    days_of_week;
    days_of_month;
    months;
}
exports.TimeGroupIntervalDto = TimeGroupIntervalDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], TimeGroupIntervalDto.prototype, "time_start", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], TimeGroupIntervalDto.prototype, "time_end", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], TimeGroupIntervalDto.prototype, "days_of_week", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], TimeGroupIntervalDto.prototype, "days_of_month", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], TimeGroupIntervalDto.prototype, "months", void 0);
class ScheduleParamsDto {
    intervals;
}
exports.ScheduleParamsDto = ScheduleParamsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TimeGroupIntervalDto),
    __metadata("design:type", Array)
], ScheduleParamsDto.prototype, "intervals", void 0);
class CmdParamsDto {
    command;
}
exports.CmdParamsDto = CmdParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[^\n\r]*$/),
    __metadata("design:type", String)
], CmdParamsDto.prototype, "command", void 0);
class WebhookParamsDto {
    url;
}
exports.WebhookParamsDto = WebhookParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], WebhookParamsDto.prototype, "url", void 0);
//# sourceMappingURL=control.params.dto.js.map