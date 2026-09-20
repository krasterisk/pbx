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
exports.ClickToCallDto = exports.WarmTransferQueueDto = exports.ZombieResetDto = exports.ConferenceAddDto = exports.RetrieveParkedCallDto = exports.ParkCallDto = void 0;
/**
 * DTOs for the professional call-control set (D-27/D-28/D-29/D-33).
 * Kept in a separate file from dto/callcenter.dto.ts to avoid a wave-2/3
 * collision with other plans editing that file (same convention as
 * dto/callcenter-permissions.dto.ts).
 */
const class_validator_1 = require("class-validator");
class ParkCallDto {
    /** uniqueid of the operator's own active call to park */
    uniqueid;
}
exports.ParkCallDto = ParkCallDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], ParkCallDto.prototype, "uniqueid", void 0);
class RetrieveParkedCallDto {
    /** Parking-space extension announced by Asterisk when the call was parked */
    parkingSpace;
}
exports.RetrieveParkedCallDto = RetrieveParkedCallDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], RetrieveParkedCallDto.prototype, "parkingSpace", void 0);
class ConferenceAddDto {
    /** uniqueid of the operator's own active call to conference */
    uniqueid;
    /** Extension/agent interface to add as the third party */
    target;
}
exports.ConferenceAddDto = ConferenceAddDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], ConferenceAddDto.prototype, "uniqueid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], ConferenceAddDto.prototype, "target", void 0);
class ZombieResetDto {
    /** uniqueid of the operator's own stuck call to reset */
    uniqueid;
}
exports.ZombieResetDto = ZombieResetDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], ZombieResetDto.prototype, "uniqueid", void 0);
class WarmTransferQueueDto {
    /** uniqueid of the operator's own active call to transfer */
    uniqueid;
    /** Target queue name */
    queue;
}
exports.WarmTransferQueueDto = WarmTransferQueueDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], WarmTransferQueueDto.prototype, "uniqueid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], WarmTransferQueueDto.prototype, "queue", void 0);
class ClickToCallDto {
    /** Number/extension to dial */
    target;
}
exports.ClickToCallDto = ClickToCallDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], ClickToCallDto.prototype, "target", void 0);
//# sourceMappingURL=callcenter-callcontrol.dto.js.map