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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DirectoryLookupController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectoryLookupController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dialplan_api_key_1 = require("../dialplan-bridge/dialplan-api-key");
const directories_service_1 = require("./directories.service");
let DirectoryLookupController = DirectoryLookupController_1 = class DirectoryLookupController {
    directoriesService;
    configService;
    logger = new common_1.Logger(DirectoryLookupController_1.name);
    apiKey;
    constructor(directoriesService, configService) {
        this.directoriesService = directoriesService;
        this.configService = configService;
        this.apiKey = this.configService.get('DIALPLAN_API_KEY') || '';
    }
    async lookup(directoryUidRaw, userUidRaw, key, fieldUidsRaw, apiKey) {
        this.assertKey(apiKey);
        const started = Date.now();
        let outcome = 'error';
        let matchKind = null;
        let directoryUid = parsePositiveInt(directoryUidRaw);
        let userUid = parsePositiveInt(userUidRaw);
        try {
            const fieldUids = parseFieldUids(fieldUidsRaw);
            if (directoryUid == null || userUid == null || fieldUids == null) {
                return 'KDL1|ERROR';
            }
            const result = await this.directoriesService.lookup({
                directoryUid,
                userUid,
                key,
                fieldUids,
            });
            outcome = result.status === 'FOUND'
                ? 'found'
                : result.status === 'NOT_FOUND'
                    ? 'not_found'
                    : 'error';
            matchKind = result.matchKind ?? null;
            return encodeLookupResponse(result);
        }
        catch (err) {
            this.logger.error('Directory lookup failed', err instanceof Error ? err.stack : String(err));
            return 'KDL1|ERROR';
        }
        finally {
            this.logger.log(JSON.stringify({
                duration_ms: Date.now() - started,
                outcome,
                user_uid: userUid,
                directory_uid: directoryUid,
                match_kind: matchKind,
            }));
        }
    }
    assertKey(provided) {
        if (!(0, dialplan_api_key_1.timingSafeApiKeyEqual)(this.apiKey, provided)) {
            this.logger.warn('Unauthorized internal directory lookup');
            throw new common_1.UnauthorizedException('Invalid API key');
        }
    }
};
exports.DirectoryLookupController = DirectoryLookupController;
__decorate([
    (0, common_1.Get)('directory-lookup'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Query)('directory_uid')),
    __param(1, (0, common_1.Query)('user_uid')),
    __param(2, (0, common_1.Query)('key')),
    __param(3, (0, common_1.Query)('field_uids')),
    __param(4, (0, common_1.Query)('api_key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], DirectoryLookupController.prototype, "lookup", null);
exports.DirectoryLookupController = DirectoryLookupController = DirectoryLookupController_1 = __decorate([
    (0, common_1.Controller)('internal/dialplan'),
    __metadata("design:paramtypes", [directories_service_1.DirectoriesService,
        config_1.ConfigService])
], DirectoryLookupController);
function encodeLookupResponse(result) {
    if (result.status !== 'FOUND')
        return `KDL1|${result.status}`;
    return [
        'KDL1',
        'FOUND',
        ...result.values.map((value) => Buffer.from(String(value ?? ''), 'utf8').toString('base64')),
    ].join('|');
}
function parsePositiveInt(raw) {
    if (typeof raw !== 'string' || raw.trim() === '')
        return null;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1)
        return null;
    return value;
}
function parseFieldUids(raw) {
    if (raw == null || String(raw).trim() === '')
        return [];
    const seen = new Set();
    const result = [];
    for (const part of String(raw).split(',')) {
        const trimmed = part.trim();
        if (!trimmed)
            return null;
        const value = Number(trimmed);
        if (!Number.isInteger(value) || value < 1)
            return null;
        if (seen.has(value))
            continue;
        seen.add(value);
        result.push(value);
    }
    return result;
}
//# sourceMappingURL=directory-lookup.controller.js.map