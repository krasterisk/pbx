"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REGISTRATION_EXPIRATION = exports.DEFAULT_QUALIFY_FREQUENCY = void 0;
exports.resolveQualifyFrequency = resolveQualifyFrequency;
exports.resolveRegistrationExpiration = resolveRegistrationExpiration;
exports.DEFAULT_QUALIFY_FREQUENCY = 120;
exports.DEFAULT_REGISTRATION_EXPIRATION = 600;
/** OPTIONS interval in seconds. 0 disables qualify. */
function resolveQualifyFrequency(value) {
    if (value == null || Number.isNaN(Number(value)))
        return exports.DEFAULT_QUALIFY_FREQUENCY;
    return Math.max(0, Math.min(3600, Math.floor(Number(value))));
}
/** Outbound REGISTER Expires in seconds. */
function resolveRegistrationExpiration(value) {
    if (value == null || Number.isNaN(Number(value)))
        return exports.DEFAULT_REGISTRATION_EXPIRATION;
    return Math.max(60, Math.min(86400, Math.floor(Number(value))));
}
//# sourceMappingURL=trunk-timers.util.js.map