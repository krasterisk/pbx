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
exports.PeerSpyDto = void 0;
/**
 * DTOs for granular-permissions / peer ChanSpy endpoints (D-21…D-25, D-38/D-39).
 * Kept in a separate file from dto/callcenter.dto.ts to avoid a wave-2 collision
 * with 09-03's edits to that file.
 */
const class_validator_1 = require("class-validator");
class PeerSpyDto {
    /** Target agent SIP interface, e.g. "PJSIP/e101_42" */
    targetInterface;
    /** D-22: listen is MVP baseline; whisper/barge require the requester's spy_modes right. */
    mode;
}
exports.PeerSpyDto = PeerSpyDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], PeerSpyDto.prototype, "targetInterface", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['listen', 'whisper', 'barge']),
    __metadata("design:type", String)
], PeerSpyDto.prototype, "mode", void 0);
//# sourceMappingURL=callcenter-permissions.dto.js.map