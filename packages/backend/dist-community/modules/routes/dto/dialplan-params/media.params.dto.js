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
exports.ToFaxParamsDto = exports.RecordParamsDto = exports.AiVoiceRobotParamsDto = exports.VoiceRobotParamsDto = exports.Text2SpeechParamsDto = exports.TtsSettingsDto = exports.PlaybackParamsDto = exports.PlayPromptParamsDto = exports.MediaOptionsDto = void 0;
exports.parseMediaOptions = parseMediaOptions;
exports.serializeMediaOptions = serializeMediaOptions;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const shared_1 = require("@krasterisk/shared");
const dialplan_options_util_1 = require("../../../../shared/utils/dialplan-options.util");
const MIX_MODES = ['say', 'mix'];
const SAFE_TEXT = /^[^\n\r;]*$/;
const RAW_FLAGS = /^[A-Za-z0-9().,:_-]*$/;
function parseMediaOptions(input) {
    const result = {};
    const rawParts = [];
    for (const token of (0, dialplan_options_util_1.parseOptions)(input).tokens) {
        if (token === 'say') {
            result.mixMode = 'say';
            continue;
        }
        if (token === 'mix') {
            result.mixMode = 'mix';
            continue;
        }
        if (token === 'n') {
            result.noanswer = true;
            continue;
        }
        if (token === 's') {
            result.skip = true;
            continue;
        }
        if (token === 'p') {
            result.p = true;
            continue;
        }
        rawParts.push(token);
    }
    if (rawParts.length)
        result.raw = rawParts.join('');
    return result;
}
function serializeMediaOptions(opts) {
    const tokens = [];
    if (opts.noanswer)
        tokens.push('n');
    if (opts.skip)
        tokens.push('s');
    if (opts.p)
        tokens.push('p');
    if (opts.mixMode === 'say')
        tokens.push('say');
    if (opts.mixMode === 'mix')
        tokens.push('mix');
    if (opts.raw)
        tokens.push(opts.raw);
    return (0, dialplan_options_util_1.serializeOptions)({ tokens });
}
class MediaOptionsDto {
    static fromString(input) {
        const parsed = parseMediaOptions(input);
        const dto = new MediaOptionsDto();
        dto.noanswer = parsed.noanswer;
        dto.skip = parsed.skip;
        dto.p = parsed.p;
        dto.mixMode = parsed.mixMode;
        dto.raw = parsed.raw;
        return dto;
    }
    noanswer;
    skip;
    p;
    mixMode;
    raw;
}
exports.MediaOptionsDto = MediaOptionsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MediaOptionsDto.prototype, "noanswer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MediaOptionsDto.prototype, "skip", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MediaOptionsDto.prototype, "p", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(MIX_MODES),
    __metadata("design:type", String)
], MediaOptionsDto.prototype, "mixMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(RAW_FLAGS),
    __metadata("design:type", String)
], MediaOptionsDto.prototype, "raw", void 0);
function transformMediaOptions({ value }) {
    if (typeof value === 'string')
        return MediaOptionsDto.fromString(value);
    return value;
}
class MediaParamsBase {
    file;
    options;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], MediaParamsBase.prototype, "file", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(transformMediaOptions),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => MediaOptionsDto),
    __metadata("design:type", Object)
], MediaParamsBase.prototype, "options", void 0);
class PlayPromptParamsDto extends MediaParamsBase {
}
exports.PlayPromptParamsDto = PlayPromptParamsDto;
const SAFE_PROMPT_FILE = /^[A-Za-z0-9._-]*$/;
const LANG_OVERRIDE = /^[A-Za-z]{1,8}(?:-[A-Za-z]{1,8})?$/;
const MAX_DIGIT_TIMEOUT = 60;
function optionsHasP(options) {
    if (!options)
        return false;
    if (typeof options === 'string')
        return parseMediaOptions(options).p === true;
    return options.p === true;
}
let IsPlaybackFilesConstraint = class IsPlaybackFilesConstraint {
    validate(value) {
        if (value === undefined || value === null || value === '')
            return true;
        const list = Array.isArray(value) ? value : [value];
        return list.every((item) => typeof item === 'string' && SAFE_PROMPT_FILE.test(item));
    }
    defaultMessage() {
        return 'files must be prompt identifiers, not a path';
    }
};
IsPlaybackFilesConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isPlaybackFiles', async: false })
], IsPlaybackFilesConstraint);
let PlaybackOptionApplicabilityConstraint = class PlaybackOptionApplicabilityConstraint {
    validate(_value, args) {
        const obj = args.object;
        if (!obj.mode)
            return true;
        if (obj.mode !== 'control' && optionsHasP(obj.options))
            return false;
        if (obj.mode !== 'menu' && obj.langoverride)
            return false;
        return true;
    }
    defaultMessage(args) {
        const obj = args.object;
        if (obj.mode !== 'control' && optionsHasP(obj.options)) {
            return 'option p is only valid in control playback mode';
        }
        return 'langoverride is only valid in menu playback mode';
    }
};
PlaybackOptionApplicabilityConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'playbackOptionApplicability', async: false })
], PlaybackOptionApplicabilityConstraint);
class PlaybackParamsDto extends MediaParamsBase {
    mode;
    files;
    langoverride;
    digittimeout;
}
exports.PlaybackParamsDto = PlaybackParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(shared_1.PLAYBACK_MODES),
    (0, class_validator_1.Validate)(PlaybackOptionApplicabilityConstraint),
    __metadata("design:type", String)
], PlaybackParamsDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Validate)(IsPlaybackFilesConstraint),
    __metadata("design:type", Object)
], PlaybackParamsDto.prototype, "files", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8),
    (0, class_validator_1.Matches)(LANG_OVERRIDE),
    __metadata("design:type", String)
], PlaybackParamsDto.prototype, "langoverride", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(MAX_DIGIT_TIMEOUT),
    __metadata("design:type", Number)
], PlaybackParamsDto.prototype, "digittimeout", void 0);
/** Same override contract as IVR phrases and synthesized prompts. */
class TtsSettingsDto {
    voice;
    language_code;
    speed;
    speaking_rate;
    role;
    pitch_shift;
}
exports.TtsSettingsDto = TtsSettingsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], TtsSettingsDto.prototype, "voice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], TtsSettingsDto.prototype, "language_code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], TtsSettingsDto.prototype, "speed", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], TtsSettingsDto.prototype, "speaking_rate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], TtsSettingsDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], TtsSettingsDto.prototype, "pitch_shift", void 0);
class Text2SpeechParamsDto {
    text;
    engine;
    settings;
    options;
    langoverride;
    digittimeout;
}
exports.Text2SpeechParamsDto = Text2SpeechParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], Text2SpeechParamsDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value === '' || value == null)
            return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : value;
    }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], Text2SpeechParamsDto.prototype, "engine", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => TtsSettingsDto),
    __metadata("design:type", TtsSettingsDto)
], Text2SpeechParamsDto.prototype, "settings", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(transformMediaOptions),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => MediaOptionsDto),
    __metadata("design:type", Object)
], Text2SpeechParamsDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], Text2SpeechParamsDto.prototype, "langoverride", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], Text2SpeechParamsDto.prototype, "digittimeout", void 0);
class VoiceRobotParamsDto {
    robot_uid;
}
exports.VoiceRobotParamsDto = VoiceRobotParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], VoiceRobotParamsDto.prototype, "robot_uid", void 0);
class AiVoiceRobotParamsDto {
    deployment_id;
}
exports.AiVoiceRobotParamsDto = AiVoiceRobotParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(36),
    (0, class_validator_1.Matches)(/^[0-9a-fA-F-]{1,36}$/),
    __metadata("design:type", String)
], AiVoiceRobotParamsDto.prototype, "deployment_id", void 0);
class RecordParamsDto {
    silence_timeout;
    max_timer;
    options;
    langoverride;
    digittimeout;
}
exports.RecordParamsDto = RecordParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RecordParamsDto.prototype, "silence_timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RecordParamsDto.prototype, "max_timer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(transformMediaOptions),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => MediaOptionsDto),
    __metadata("design:type", Object)
], RecordParamsDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], RecordParamsDto.prototype, "langoverride", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RecordParamsDto.prototype, "digittimeout", void 0);
class ToFaxParamsDto {
    email;
}
exports.ToFaxParamsDto = ToFaxParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ToFaxParamsDto.prototype, "email", void 0);
//# sourceMappingURL=media.params.dto.js.map