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
exports.MissedCallActionDto = void 0;
/**
 * DTO for the smart missed-calls engine (D-16/D-18/D-19). Kept in a
 * separate file from dto/callcenter.dto.ts to avoid a wave collision
 * (same convention as dto/callcenter-callcontrol.dto.ts).
 */
const class_validator_1 = require("class-validator");
class MissedCallActionDto {
    /** Caller number identifying the missed-call number-group to claim/callback */
    callerIdNum;
}
exports.MissedCallActionDto = MissedCallActionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], MissedCallActionDto.prototype, "callerIdNum", void 0);
//# sourceMappingURL=callcenter-missed.dto.js.map