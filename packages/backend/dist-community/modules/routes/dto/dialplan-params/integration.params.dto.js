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
exports.CallbackParamsDto = exports.CollectInputParamsDto = exports.HttpRequestParamsDto = exports.NotifyParamsDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const shared_1 = require("@krasterisk/shared");
const dialplan_http_util_1 = require("../../../../shared/utils/dialplan-http.util");
const SAFE_TEXT = /^[^\n\r;]*$/;
/**
 * The channel comes from the integration, so the step only carries the
 * integration, the text, and an optional recipient override.
 */
class NotifyParamsDto {
    integration_uid;
    body;
    target;
    subject;
}
exports.NotifyParamsDto = NotifyParamsDto;
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => (value === '' || value == null ? undefined : Number(value))),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], NotifyParamsDto.prototype, "integration_uid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], NotifyParamsDto.prototype, "body", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], NotifyParamsDto.prototype, "target", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], NotifyParamsDto.prototype, "subject", void 0);
const ALLOWED_HTTP_HEADERS = ['Accept', 'Content-Type', 'Authorization', 'X-Request-Id'];
let IsSafeHttpUrlConstraint = class IsSafeHttpUrlConstraint {
    validate(value) {
        if (typeof value !== 'string' || !value)
            return false;
        try {
            (0, dialplan_http_util_1.assertSafeHttpUrl)(value);
            return true;
        }
        catch {
            return false;
        }
    }
    defaultMessage() {
        return 'url must be https and must not target a private, loopback, or metadata address';
    }
};
IsSafeHttpUrlConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isSafeHttpUrl', async: false })
], IsSafeHttpUrlConstraint);
let IsAllowedHttpHeadersConstraint = class IsAllowedHttpHeadersConstraint {
    validate(value) {
        if (value == null)
            return true;
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return false;
        return Object.keys(value).every((key) => ALLOWED_HTTP_HEADERS.includes(key));
    }
    defaultMessage() {
        return 'headers keys must be from the allowed set';
    }
};
IsAllowedHttpHeadersConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'isAllowedHttpHeaders', async: false })
], IsAllowedHttpHeadersConstraint);
class HttpRequestParamsDto {
    url;
    method;
    timeout;
    headers;
    body;
}
exports.HttpRequestParamsDto = HttpRequestParamsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.Validate)(IsSafeHttpUrlConstraint),
    __metadata("design:type", String)
], HttpRequestParamsDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['GET', 'POST']),
    __metadata("design:type", String)
], HttpRequestParamsDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], HttpRequestParamsDto.prototype, "timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.Validate)(IsAllowedHttpHeadersConstraint),
    __metadata("design:type", Object)
], HttpRequestParamsDto.prototype, "headers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(SAFE_TEXT),
    __metadata("design:type", String)
], HttpRequestParamsDto.prototype, "body", void 0);
class CollectInputParamsDto {
    variableName;
    digitsCount;
    timeout;
    promptFile;
    attempts;
    mode;
}
exports.CollectInputParamsDto = CollectInputParamsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(shared_1.CONDITION_VAR_NAME_RE),
    __metadata("design:type", String)
], CollectInputParamsDto.prototype, "variableName", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CollectInputParamsDto.prototype, "digitsCount", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CollectInputParamsDto.prototype, "timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[A-Za-z0-9_/-]+$/),
    __metadata("design:type", String)
], CollectInputParamsDto.prototype, "promptFile", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CollectInputParamsDto.prototype, "attempts", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['digits', 'extension']),
    __metadata("design:type", String)
], CollectInputParamsDto.prototype, "mode", void 0);
const WINDOW_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** D-41 Surface K — window and attempts on the route step. */
class CallbackParamsDto {
    window_start;
    window_end;
    max_attempts;
    pause_minutes;
}
exports.CallbackParamsDto = CallbackParamsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(WINDOW_HH_MM),
    __metadata("design:type", String)
], CallbackParamsDto.prototype, "window_start", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(WINDOW_HH_MM),
    __metadata("design:type", String)
], CallbackParamsDto.prototype, "window_end", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], CallbackParamsDto.prototype, "max_attempts", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(1440),
    __metadata("design:type", Number)
], CallbackParamsDto.prototype, "pause_minutes", void 0);
//# sourceMappingURL=integration.params.dto.js.map