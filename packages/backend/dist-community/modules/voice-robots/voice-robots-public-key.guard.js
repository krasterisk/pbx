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
exports.VoiceRobotsPublicKeyGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dialplan_api_key_1 = require("../dialplan-bridge/dialplan-api-key");
/** v3 public robot URLs stay; unauthenticated access is no longer allowed. */
let VoiceRobotsPublicKeyGuard = class VoiceRobotsPublicKeyGuard {
    config;
    constructor(config) {
        this.config = config;
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const header = request.headers?.['x-api-key'];
        const query = request.query?.api_key;
        const body = request.body?.api_key;
        const provided = [header, query, body].find((value) => typeof value === 'string' && value.length > 0) ?? '';
        const expected = this.config.get('VOICE_ROBOTS_PUBLIC_API_KEY')
            || this.config.get('DIALPLAN_API_KEY')
            || '';
        if (!(0, dialplan_api_key_1.timingSafeApiKeyEqual)(expected, provided)) {
            throw new common_1.UnauthorizedException('Invalid API key');
        }
        return true;
    }
};
exports.VoiceRobotsPublicKeyGuard = VoiceRobotsPublicKeyGuard;
exports.VoiceRobotsPublicKeyGuard = VoiceRobotsPublicKeyGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], VoiceRobotsPublicKeyGuard);
//# sourceMappingURL=voice-robots-public-key.guard.js.map