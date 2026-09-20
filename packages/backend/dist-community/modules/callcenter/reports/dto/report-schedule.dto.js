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
exports.UpdateReportScheduleDto = exports.CreateReportScheduleDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const callcenter_reports_types_1 = require("../callcenter-reports.types");
const PERIOD_PRESETS = [
    'today',
    'yesterday',
    'last-7-days',
    'last-30-days',
    'previous-month',
];
class CreateReportScheduleDto {
    name;
    report_id;
    format;
    period_preset;
    filters;
    frequency;
    hour;
    minute;
    day_of_week;
    day_of_month;
    integration_uid;
    target;
    subject_template;
    message_template;
    enabled;
}
exports.CreateReportScheduleDto = CreateReportScheduleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], CreateReportScheduleDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsIn)([...callcenter_reports_types_1.CC_REPORT_IDS]),
    __metadata("design:type", String)
], CreateReportScheduleDto.prototype, "report_id", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['csv', 'xlsx']),
    __metadata("design:type", String)
], CreateReportScheduleDto.prototype, "format", void 0);
__decorate([
    (0, class_validator_1.IsIn)([...PERIOD_PRESETS]),
    __metadata("design:type", Object)
], CreateReportScheduleDto.prototype, "period_preset", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateReportScheduleDto.prototype, "filters", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['daily', 'weekly', 'monthly']),
    __metadata("design:type", String)
], CreateReportScheduleDto.prototype, "frequency", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(23),
    __metadata("design:type", Number)
], CreateReportScheduleDto.prototype, "hour", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(59),
    __metadata("design:type", Number)
], CreateReportScheduleDto.prototype, "minute", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(6),
    __metadata("design:type", Number)
], CreateReportScheduleDto.prototype, "day_of_week", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(28),
    __metadata("design:type", Number)
], CreateReportScheduleDto.prototype, "day_of_month", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateReportScheduleDto.prototype, "integration_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(256),
    __metadata("design:type", String)
], CreateReportScheduleDto.prototype, "target", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(256),
    __metadata("design:type", String)
], CreateReportScheduleDto.prototype, "subject_template", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateReportScheduleDto.prototype, "message_template", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateReportScheduleDto.prototype, "enabled", void 0);
class UpdateReportScheduleDto {
    name;
    report_id;
    format;
    period_preset;
    filters;
    frequency;
    hour;
    minute;
    day_of_week;
    day_of_month;
    integration_uid;
    target;
    subject_template;
    message_template;
    enabled;
}
exports.UpdateReportScheduleDto = UpdateReportScheduleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], UpdateReportScheduleDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...callcenter_reports_types_1.CC_REPORT_IDS]),
    __metadata("design:type", String)
], UpdateReportScheduleDto.prototype, "report_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['csv', 'xlsx']),
    __metadata("design:type", String)
], UpdateReportScheduleDto.prototype, "format", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...PERIOD_PRESETS]),
    __metadata("design:type", Object)
], UpdateReportScheduleDto.prototype, "period_preset", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateReportScheduleDto.prototype, "filters", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['daily', 'weekly', 'monthly']),
    __metadata("design:type", String)
], UpdateReportScheduleDto.prototype, "frequency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(23),
    __metadata("design:type", Number)
], UpdateReportScheduleDto.prototype, "hour", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(59),
    __metadata("design:type", Number)
], UpdateReportScheduleDto.prototype, "minute", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(6),
    __metadata("design:type", Object)
], UpdateReportScheduleDto.prototype, "day_of_week", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(28),
    __metadata("design:type", Object)
], UpdateReportScheduleDto.prototype, "day_of_month", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateReportScheduleDto.prototype, "integration_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(256),
    __metadata("design:type", Object)
], UpdateReportScheduleDto.prototype, "target", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(256),
    __metadata("design:type", Object)
], UpdateReportScheduleDto.prototype, "subject_template", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateReportScheduleDto.prototype, "message_template", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateReportScheduleDto.prototype, "enabled", void 0);
//# sourceMappingURL=report-schedule.dto.js.map