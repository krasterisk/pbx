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
exports.CreateConferenceRoomDto = exports.CONFERENCE_PIN_PATTERN = exports.CONFERENCE_ROOM_NUMBER_PATTERN = void 0;
const class_validator_1 = require("class-validator");
exports.CONFERENCE_ROOM_NUMBER_PATTERN = /^\d{1,32}$/;
exports.CONFERENCE_PIN_PATTERN = /^\d{4,32}$/;
class CreateConferenceRoomDto {
    number;
    name;
    kind;
    entry_strictness;
    pin;
    wait_marked;
    end_marked;
    record_mode;
    notify_recording;
    invite_external_scope;
    tariff_max_participants;
    musiconhold;
    announce_join_leave;
}
exports.CreateConferenceRoomDto = CreateConferenceRoomDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.CONFERENCE_ROOM_NUMBER_PATTERN),
    __metadata("design:type", String)
], CreateConferenceRoomDto.prototype, "number", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    __metadata("design:type", String)
], CreateConferenceRoomDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['permanent', 'ephemeral']),
    __metadata("design:type", String)
], CreateConferenceRoomDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['token_name', 'token_name_pin', 'token_name_pin_moderator']),
    __metadata("design:type", String)
], CreateConferenceRoomDto.prototype, "entry_strictness", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.CONFERENCE_PIN_PATTERN),
    __metadata("design:type", Object)
], CreateConferenceRoomDto.prototype, "pin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateConferenceRoomDto.prototype, "wait_marked", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateConferenceRoomDto.prototype, "end_marked", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['off', 'auto', 'button', 'both']),
    __metadata("design:type", String)
], CreateConferenceRoomDto.prototype, "record_mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateConferenceRoomDto.prototype, "notify_recording", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['owner', 'moderator', 'anyone']),
    __metadata("design:type", String)
], CreateConferenceRoomDto.prototype, "invite_external_scope", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10_000),
    __metadata("design:type", Object)
], CreateConferenceRoomDto.prototype, "tariff_max_participants", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 128),
    __metadata("design:type", Object)
], CreateConferenceRoomDto.prototype, "musiconhold", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateConferenceRoomDto.prototype, "announce_join_leave", void 0);
//# sourceMappingURL=create-conference-room.dto.js.map