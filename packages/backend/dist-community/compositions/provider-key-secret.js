"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDER_KEY_SECRET_VAR = void 0;
exports.assertProviderKeySecret = assertProviderKeySecret;
const common_1 = require("@nestjs/common");
exports.PROVIDER_KEY_SECRET_VAR = 'CC_AI_KEY_SECRET';
function assertProviderKeySecret(env = process.env, logger = new common_1.Logger('AppModule')) {
    if (env.CC_AI_KEY_SECRET)
        return;
    if (env.NODE_ENV === 'development') {
        logger.warn(`${exports.PROVIDER_KEY_SECRET_VAR} is not set — continuing with the development fallback`);
        return;
    }
    throw new Error(`${exports.PROVIDER_KEY_SECRET_VAR} is not set`);
}
//# sourceMappingURL=provider-key-secret.js.map