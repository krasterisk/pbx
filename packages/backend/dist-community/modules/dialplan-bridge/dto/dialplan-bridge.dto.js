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
exports.TtsDialplanDto = exports.TelegramDialplanDto = exports.SendmailPeerDialplanDto = exports.HttpRequestDialplanDto = exports.WebhookDialplanDto = exports.SetclidDialplanDto = exports.DialplanBridgeBaseDto = void 0;
const class_validator_1 = require("class-validator");
class DialplanBridgeBaseDto {
    api_key;
    vpbx_user_uid;
    clid;
    exten;
    uniqueid;
}
exports.DialplanBridgeBaseDto = DialplanBridgeBaseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DialplanBridgeBaseDto.prototype, "api_key", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DialplanBridgeBaseDto.prototype, "vpbx_user_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DialplanBridgeBaseDto.prototype, "clid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DialplanBridgeBaseDto.prototype, "exten", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DialplanBridgeBaseDto.prototype, "uniqueid", void 0);
class SetclidDialplanDto extends DialplanBridgeBaseDto {
    list_uid;
    clidnum;
}
exports.SetclidDialplanDto = SetclidDialplanDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SetclidDialplanDto.prototype, "list_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SetclidDialplanDto.prototype, "clidnum", void 0);
class WebhookDialplanDto extends DialplanBridgeBaseDto {
    url;
}
exports.WebhookDialplanDto = WebhookDialplanDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WebhookDialplanDto.prototype, "url", void 0);
class HttpRequestDialplanDto extends DialplanBridgeBaseDto {
    url;
    method;
    body;
    timeout;
    route_uid;
    action_id;
}
exports.HttpRequestDialplanDto = HttpRequestDialplanDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HttpRequestDialplanDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HttpRequestDialplanDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HttpRequestDialplanDto.prototype, "body", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HttpRequestDialplanDto.prototype, "timeout", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HttpRequestDialplanDto.prototype, "route_uid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HttpRequestDialplanDto.prototype, "action_id", void 0);
class SendmailPeerDialplanDto extends DialplanBridgeBaseDto {
    text;
}
exports.SendmailPeerDialplanDto = SendmailPeerDialplanDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendmailPeerDialplanDto.prototype, "text", void 0);
class TelegramDialplanDto extends DialplanBridgeBaseDto {
    chat_id;
    text;
}
exports.TelegramDialplanDto = TelegramDialplanDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TelegramDialplanDto.prototype, "chat_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TelegramDialplanDto.prototype, "text", void 0);
class TtsDialplanDto extends DialplanBridgeBaseDto {
    text;
    engine;
    // Flattened IIvrPhraseTtsSettings — merged over the engine settings server-side.
    voice;
    language_code;
    speed;
    speaking_rate;
    role;
    pitch_shift;
}
exports.TtsDialplanDto = TtsDialplanDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TtsDialplanDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TtsDialplanDto.prototype, "engine", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TtsDialplanDto.prototype, "voice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TtsDialplanDto.prototype, "language_code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TtsDialplanDto.prototype, "speed", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TtsDialplanDto.prototype, "speaking_rate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TtsDialplanDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TtsDialplanDto.prototype, "pitch_shift", void 0);
//# sourceMappingURL=dialplan-bridge.dto.js.map