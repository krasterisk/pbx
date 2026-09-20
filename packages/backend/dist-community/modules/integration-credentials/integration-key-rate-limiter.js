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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationKeyRateLimiter = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const integration_credential_models_1 = require("./integration-credential.models");
/** Shared SQL limits apply across every API instance. Keys never expose the source address. */
let IntegrationKeyRateLimiter = class IntegrationKeyRateLimiter {
    limits;
    sequelize;
    windowMs = 60_000;
    failuresSinceCleanup = 0;
    constructor(limits, sequelize) {
        this.limits = limits;
        this.sequelize = sequelize;
    }
    key(prefix, value) {
        return (0, node_crypto_1.createHash)('sha256').update(prefix).update('\0').update(value).digest('hex');
    }
    keys(remoteAddress, selector) {
        return [this.key('ip', remoteAddress), this.key('pair', `${remoteAddress}\0${selector}`)];
    }
    async check(remoteAddress, selector, now = Date.now()) {
        const [ip, pair] = this.keys(remoteAddress, selector);
        let ipLimit;
        let pairLimit;
        try {
            [ipLimit, pairLimit] = await Promise.all([
                this.limits.findByPk(ip), this.limits.findByPk(pair),
            ]);
        }
        catch {
            throw new common_1.ServiceUnavailableException({ code: 'credential_auth_unavailable' });
        }
        if ((ipLimit && ipLimit.expires_at.getTime() > now && ipLimit.attempts >= 20)
            || (pairLimit && pairLimit.expires_at.getTime() > now && pairLimit.attempts >= 5)) {
            this.reject();
        }
    }
    async failure(remoteAddress, selector, now = Date.now()) {
        const expires = new Date(now + this.windowMs);
        const current = new Date(now);
        try {
            for (const key of this.keys(remoteAddress, selector)) {
                await this.bump(key, expires, current);
            }
            await this.cleanup(current);
        }
        catch {
            throw new common_1.ServiceUnavailableException({ code: 'credential_auth_unavailable' });
        }
    }
    /** Every management mutation consumes a shared tenant/actor bucket, successful or not. */
    async consumeManagement(context, now = Date.now()) {
        const key = this.key('management', `${context.tenantUid}\0${context.principalId}`);
        const current = new Date(now);
        try {
            await this.bump(key, new Date(now + this.windowMs), current);
            const row = await this.limits.findByPk(key);
            if (!row)
                throw new Error('Missing management rate-limit row');
            await this.cleanup(current);
            if (row.attempts > 10)
                this.reject();
        }
        catch (error) {
            if (error instanceof common_1.HttpException)
                throw error;
            throw new common_1.ServiceUnavailableException({ code: 'credential_auth_unavailable' });
        }
    }
    async cleanup(current) {
        if (++this.failuresSinceCleanup >= 256) {
            this.failuresSinceCleanup = 0;
            await this.limits.destroy({ where: { expires_at: { [sequelize_2.Op.lte]: current } } });
        }
    }
    async bump(key, expires, now) {
        // Each upsert is atomic, including concurrent first attempts on separate API nodes.
        if (this.sequelize.getDialect() === 'postgres') {
            await this.sequelize.query(`
          INSERT INTO ai_integration_auth_limits (key_hash, attempts, expires_at)
          VALUES (:key, 1, :expires)
          ON CONFLICT (key_hash) DO UPDATE SET
            attempts = CASE WHEN ai_integration_auth_limits.expires_at <= :now
              THEN 1 ELSE ai_integration_auth_limits.attempts + 1 END,
            expires_at = CASE WHEN ai_integration_auth_limits.expires_at <= :now
              THEN :expires ELSE ai_integration_auth_limits.expires_at END
        `, { replacements: { key, expires, now } });
        }
        else if (this.sequelize.getDialect() === 'mysql' || this.sequelize.getDialect() === 'mariadb') {
            await this.sequelize.query(`
          INSERT INTO ai_integration_auth_limits (key_hash, attempts, expires_at)
          VALUES (:key, 1, :expires)
          ON DUPLICATE KEY UPDATE
            attempts = IF(expires_at <= :now, 1, attempts + 1),
            expires_at = IF(expires_at <= :now, :expires, expires_at)
        `, { replacements: { key, expires, now } });
        }
        else {
            throw new Error('Unsupported integration auth limiter dialect');
        }
    }
    reject() {
        throw new common_1.HttpException({ code: 'credential_rate_limited' }, common_1.HttpStatus.TOO_MANY_REQUESTS);
    }
};
exports.IntegrationKeyRateLimiter = IntegrationKeyRateLimiter;
exports.IntegrationKeyRateLimiter = IntegrationKeyRateLimiter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(integration_credential_models_1.IntegrationAuthLimit)),
    __metadata("design:paramtypes", [Object, sequelize_typescript_1.Sequelize])
], IntegrationKeyRateLimiter);
//# sourceMappingURL=integration-key-rate-limiter.js.map