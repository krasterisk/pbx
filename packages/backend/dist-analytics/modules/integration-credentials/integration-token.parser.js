"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIntegrationAuthorization = parseIntegrationAuthorization;
const common_1 = require("@nestjs/common");
/** New integration endpoints never accept the legacy SSE query-token fallback. */
function parseIntegrationAuthorization(request) {
    const raw = request.rawHeaders ?? [];
    const authorizationFields = raw.filter((field, index) => index % 2 === 0
        && field.toLowerCase() === 'authorization').length;
    if (authorizationFields > 1 || request.query?.token !== undefined) {
        throw new common_1.BadRequestException({ code: 'ambiguous_or_query_credential' });
    }
    const value = request.headers?.authorization;
    if (typeof value !== 'string' || value.length > 1600) {
        throw new common_1.UnauthorizedException({ code: 'credential_required' });
    }
    const match = /^Bearer ([^\s]+)$/.exec(value);
    if (!match)
        throw new common_1.UnauthorizedException({ code: 'credential_invalid' });
    const token = match[1];
    if (token.startsWith('krint_v1_')) {
        const integration = /^krint_v1_([A-Za-z0-9_-]{22})_([A-Za-z0-9_-]{43})$/.exec(token);
        if (!integration)
            throw new common_1.UnauthorizedException({ code: 'credential_invalid' });
        return { kind: 'integration', selector: integration[1], secret: integration[2] };
    }
    if (token.length > 1400 || token.split('.').length !== 3) {
        throw new common_1.UnauthorizedException({ code: 'credential_invalid' });
    }
    return { kind: 'jwt', token };
}
//# sourceMappingURL=integration-token.parser.js.map