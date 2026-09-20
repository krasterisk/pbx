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
exports.UpdateConferenceRoomDto = void 0;
const class_validator_1 = require("class-validator");
const create_conference_room_dto_1 = require("./create-conference-room.dto");
class UpdateConferenceRoomDto {
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
exports.UpdateConferenceRoomDto = UpdateConferenceRoomDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(create_conference_room_dto_1.CONFERENCE_ROOM_NUMBER_PATTERN),
    __metadata("design:type", String)
], UpdateConferenceRoomDto.prototype, "number", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    __metadata("design:type", String)
], UpdateConferenceRoomDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['permanent', 'ephemeral']),
    __metadata("design:type", String)
], UpdateConferenceRoomDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['token_name', 'token_name_pin', 'token_name_pin_moderator']),
    __metadata("design:type", String)
], UpdateConferenceRoomDto.prototype, "entry_strictness", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(create_conference_room_dto_1.CONFERENCE_PIN_PATTERN),
    __metadata("design:type", Object)
], UpdateConferenceRoomDto.prototype, "pin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateConferenceRoomDto.prototype, "wait_marked", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateConferenceRoomDto.prototype, "end_marked", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['off', 'auto', 'button', 'both']),
    __metadata("design:type", String)
], UpdateConferenceRoomDto.prototype, "record_mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateConferenceRoomDto.prototype, "notify_recording", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['owner', 'moderator', 'anyone']),
    __metadata("design:type", String)
], UpdateConferenceRoomDto.prototype, "invite_external_scope", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10_000),
    __metadata("design:type", Object)
], UpdateConferenceRoomDto.prototype, "tariff_max_participants", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 128),
    __metadata("design:type", Object)
], UpdateConferenceRoomDto.prototype, "musiconhold", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateConferenceRoomDto.prototype, "announce_join_leave", void 0);
//# sourceMappingURL=update-conference-room.dto.js.map