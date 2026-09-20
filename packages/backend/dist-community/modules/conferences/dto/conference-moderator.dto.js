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
exports.SetConferenceModeratorsDto = exports.ConferenceModeratorDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const create_conference_room_dto_1 = require("./create-conference-room.dto");
class ConferenceModeratorDto {
    endpointRef;
    role;
}
exports.ConferenceModeratorDto = ConferenceModeratorDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(create_conference_room_dto_1.CONFERENCE_ROOM_NUMBER_PATTERN),
    __metadata("design:type", String)
], ConferenceModeratorDto.prototype, "endpointRef", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['owner', 'moderator']),
    __metadata("design:type", String)
], ConferenceModeratorDto.prototype, "role", void 0);
class SetConferenceModeratorsDto {
    moderators;
}
exports.SetConferenceModeratorsDto = SetConferenceModeratorsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(64),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ConferenceModeratorDto),
    __metadata("design:type", Array)
], SetConferenceModeratorsDto.prototype, "moderators", void 0);
//# sourceMappingURL=conference-moderator.dto.js.map