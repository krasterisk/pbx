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
exports.CreateAutodialDncDto = exports.StartAutodialCampaignDto = exports.UpdateAutodialCampaignDto = exports.CreateAutodialCampaignDto = exports.AutodialScheduleDraftDto = exports.AutodialAmdDto = exports.AutodialCidPolicyDto = exports.AutodialTrunkPoolItemDto = exports.AutodialCallerIdSourceDto = exports.AutodialCallerIdDirectoryKeyDto = exports.AutodialRetryDto = exports.AutodialPacingDto = exports.AutodialPredictiveDto = exports.AutodialPacingProviderDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const shared_1 = require("@krasterisk/shared");
class AutodialPacingProviderDto {
    type;
    max_channels;
    queue_names;
    ratio;
}
exports.AutodialPacingProviderDto = AutodialPacingProviderDto;
__decorate([
    (0, class_validator_1.IsIn)(["static", "queue_agents", "trunk_channels", "tenant_cap"]),
    __metadata("design:type", String)
], AutodialPacingProviderDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AutodialPacingProviderDto.prototype, "max_channels", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AutodialPacingProviderDto.prototype, "queue_names", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.1),
    __metadata("design:type", Number)
], AutodialPacingProviderDto.prototype, "ratio", void 0);
class AutodialPredictiveDto {
    /** Regulators cap this in the low single digits; 20 is the absurdity guard. */
    target_abandon_pct;
    max_over_dial;
    min_samples;
}
exports.AutodialPredictiveDto = AutodialPredictiveDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], AutodialPredictiveDto.prototype, "target_abandon_pct", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], AutodialPredictiveDto.prototype, "max_over_dial", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AutodialPredictiveDto.prototype, "min_samples", void 0);
class AutodialPacingDto {
    providers;
    power_ratio;
    predictive;
}
exports.AutodialPacingDto = AutodialPacingDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AutodialPacingProviderDto),
    __metadata("design:type", Array)
], AutodialPacingDto.prototype, "providers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AutodialPacingDto.prototype, "power_ratio", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AutodialPredictiveDto),
    __metadata("design:type", AutodialPredictiveDto)
], AutodialPacingDto.prototype, "predictive", void 0);
class AutodialRetryDto {
    max_attempts;
    intervals_sec;
    default_interval_sec;
}
exports.AutodialRetryDto = AutodialRetryDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AutodialRetryDto.prototype, "max_attempts", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], AutodialRetryDto.prototype, "intervals_sec", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AutodialRetryDto.prototype, "default_interval_sec", void 0);
class AutodialCallerIdDirectoryKeyDto {
    source;
    field_key;
}
exports.AutodialCallerIdDirectoryKeyDto = AutodialCallerIdDirectoryKeyDto;
__decorate([
    (0, class_validator_1.IsIn)(["autodial_field"]),
    __metadata("design:type", String)
], AutodialCallerIdDirectoryKeyDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AutodialCallerIdDirectoryKeyDto.prototype, "field_key", void 0);
/**
 * Semantic requirements depend on `mode` and are completed in the campaign
 * service, where ownership of the base and directory can also be verified.
 */
class AutodialCallerIdSourceDto {
    mode;
    value;
    numbers;
    pick;
    directory_uid;
    value_field_uid;
    key;
    on_missing;
}
exports.AutodialCallerIdSourceDto = AutodialCallerIdSourceDto;
__decorate([
    (0, class_validator_1.IsIn)(["static", "pool", "directory"]),
    __metadata("design:type", String)
], AutodialCallerIdSourceDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AutodialCallerIdSourceDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AutodialCallerIdSourceDto.prototype, "numbers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["random", "round_robin"]),
    __metadata("design:type", String)
], AutodialCallerIdSourceDto.prototype, "pick", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AutodialCallerIdSourceDto.prototype, "directory_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AutodialCallerIdSourceDto.prototype, "value_field_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AutodialCallerIdDirectoryKeyDto),
    __metadata("design:type", AutodialCallerIdDirectoryKeyDto)
], AutodialCallerIdSourceDto.prototype, "key", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["fallback"]),
    __metadata("design:type", String)
], AutodialCallerIdSourceDto.prototype, "on_missing", void 0);
// Must be declared after AutodialCallerIdSourceDto: decorator metadata is
// evaluated at module initialization, before a later class declaration exists.
class AutodialTrunkPoolItemDto {
    trunk_id;
    caller_id;
    caller_id_source;
    weight;
    /** 0 / omitted = no limit tracked for this trunk */
    max_channels;
}
exports.AutodialTrunkPoolItemDto = AutodialTrunkPoolItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], AutodialTrunkPoolItemDto.prototype, "trunk_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AutodialTrunkPoolItemDto.prototype, "caller_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AutodialCallerIdSourceDto),
    __metadata("design:type", AutodialCallerIdSourceDto)
], AutodialTrunkPoolItemDto.prototype, "caller_id_source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AutodialTrunkPoolItemDto.prototype, "weight", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AutodialTrunkPoolItemDto.prototype, "max_channels", void 0);
class AutodialCidPolicyDto {
    mode;
    value;
    pool;
}
exports.AutodialCidPolicyDto = AutodialCidPolicyDto;
__decorate([
    (0, class_validator_1.IsIn)(["static", "rotate", "per_trunk"]),
    __metadata("design:type", String)
], AutodialCidPolicyDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AutodialCidPolicyDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AutodialCidPolicyDto.prototype, "pool", void 0);
class AutodialAmdDto {
    enabled;
    on_machine;
}
exports.AutodialAmdDto = AutodialAmdDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AutodialAmdDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsIn)(["hangup", "continue", "voicemail"]),
    __metadata("design:type", String)
], AutodialAmdDto.prototype, "on_machine", void 0);
class AutodialScheduleDraftDto {
    uid;
    kind;
    weekday;
    time_from;
    time_to;
    timezone;
    date_from;
    date_to;
    enabled;
}
exports.AutodialScheduleDraftDto = AutodialScheduleDraftDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AutodialScheduleDraftDto.prototype, "uid", void 0);
__decorate([
    (0, class_validator_1.IsIn)([...shared_1.AUTODIAL_SCHEDULE_KINDS]),
    __metadata("design:type", String)
], AutodialScheduleDraftDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], AutodialScheduleDraftDto.prototype, "weekday", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5),
    __metadata("design:type", String)
], AutodialScheduleDraftDto.prototype, "time_from", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5),
    __metadata("design:type", String)
], AutodialScheduleDraftDto.prototype, "time_to", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AutodialScheduleDraftDto.prototype, "timezone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], AutodialScheduleDraftDto.prototype, "date_from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], AutodialScheduleDraftDto.prototype, "date_to", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AutodialScheduleDraftDto.prototype, "enabled", void 0);
class CreateAutodialCampaignDto {
    name;
    dial_mode;
    base_uid;
    pacing;
    retry;
    trunk_pool;
    cid_policy;
    queue_names;
    scenario_actions;
    amd;
    success_min_sec;
    dial_timeout_sec;
    schedules;
}
exports.CreateAutodialCampaignDto = CreateAutodialCampaignDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateAutodialCampaignDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...shared_1.AUTODIAL_DIAL_MODES]),
    __metadata("design:type", String)
], CreateAutodialCampaignDto.prototype, "dial_mode", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateAutodialCampaignDto.prototype, "base_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AutodialPacingDto),
    __metadata("design:type", AutodialPacingDto)
], CreateAutodialCampaignDto.prototype, "pacing", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AutodialRetryDto),
    __metadata("design:type", AutodialRetryDto)
], CreateAutodialCampaignDto.prototype, "retry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AutodialTrunkPoolItemDto),
    __metadata("design:type", Array)
], CreateAutodialCampaignDto.prototype, "trunk_pool", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AutodialCidPolicyDto),
    __metadata("design:type", AutodialCidPolicyDto)
], CreateAutodialCampaignDto.prototype, "cid_policy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateAutodialCampaignDto.prototype, "queue_names", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateAutodialCampaignDto.prototype, "scenario_actions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AutodialAmdDto),
    __metadata("design:type", AutodialAmdDto)
], CreateAutodialCampaignDto.prototype, "amd", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateAutodialCampaignDto.prototype, "success_min_sec", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(5),
    __metadata("design:type", Number)
], CreateAutodialCampaignDto.prototype, "dial_timeout_sec", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AutodialScheduleDraftDto),
    __metadata("design:type", Array)
], CreateAutodialCampaignDto.prototype, "schedules", void 0);
class UpdateAutodialCampaignDto {
    expected_revision;
    name;
    dial_mode;
    base_uid;
    pacing;
    retry;
    trunk_pool;
    cid_policy;
    queue_names;
    scenario_actions;
    amd;
    success_min_sec;
    dial_timeout_sec;
    schedules;
}
exports.UpdateAutodialCampaignDto = UpdateAutodialCampaignDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateAutodialCampaignDto.prototype, "expected_revision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateAutodialCampaignDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...shared_1.AUTODIAL_DIAL_MODES]),
    __metadata("design:type", String)
], UpdateAutodialCampaignDto.prototype, "dial_mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateAutodialCampaignDto.prototype, "base_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AutodialPacingDto),
    __metadata("design:type", AutodialPacingDto)
], UpdateAutodialCampaignDto.prototype, "pacing", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AutodialRetryDto),
    __metadata("design:type", AutodialRetryDto)
], UpdateAutodialCampaignDto.prototype, "retry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AutodialTrunkPoolItemDto),
    __metadata("design:type", Array)
], UpdateAutodialCampaignDto.prototype, "trunk_pool", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AutodialCidPolicyDto),
    __metadata("design:type", AutodialCidPolicyDto)
], UpdateAutodialCampaignDto.prototype, "cid_policy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateAutodialCampaignDto.prototype, "queue_names", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], UpdateAutodialCampaignDto.prototype, "scenario_actions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AutodialAmdDto),
    __metadata("design:type", AutodialAmdDto)
], UpdateAutodialCampaignDto.prototype, "amd", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateAutodialCampaignDto.prototype, "success_min_sec", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(5),
    __metadata("design:type", Number)
], UpdateAutodialCampaignDto.prototype, "dial_timeout_sec", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AutodialScheduleDraftDto),
    __metadata("design:type", Array)
], UpdateAutodialCampaignDto.prototype, "schedules", void 0);
/** D-19: filter contacts by prior task dispositions when (re)starting. */
class StartAutodialCampaignDto {
    include_dispositions;
    skip_existing_tasks;
}
exports.StartAutodialCampaignDto = StartAutodialCampaignDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)([...shared_1.AUTODIAL_DISPOSITIONS], { each: true }),
    __metadata("design:type", Array)
], StartAutodialCampaignDto.prototype, "include_dispositions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], StartAutodialCampaignDto.prototype, "skip_existing_tasks", void 0);
class CreateAutodialDncDto {
    scope;
    scope_uid;
    normalized_phone;
    reason;
    source;
    expires_at;
}
exports.CreateAutodialDncDto = CreateAutodialDncDto;
__decorate([
    (0, class_validator_1.IsIn)(["global", "campaign", "base"]),
    __metadata("design:type", String)
], CreateAutodialDncDto.prototype, "scope", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Object)
], CreateAutodialDncDto.prototype, "scope_uid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CreateAutodialDncDto.prototype, "normalized_phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateAutodialDncDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CreateAutodialDncDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateAutodialDncDto.prototype, "expires_at", void 0);
//# sourceMappingURL=autodial-campaign.dto.js.map