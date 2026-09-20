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
exports.TenantContextGuard = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const jwt_secret_1 = require("../auth/jwt-secret");
const integration_token_parser_1 = require("./integration-token.parser");
const tenant_context_resolver_1 = require("./tenant-context.resolver");
const integration_credentials_service_1 = require("./integration-credentials.service");
const integration_key_rate_limiter_1 = require("./integration-key-rate-limiter");
const integration_client_address_1 = require("./integration-client-address");
/** Explicit new-route guard for header-only user JWTs and integration credentials. */
let TenantContextGuard = class TenantContextGuard {
    jwt;
    config;
    resolver;
    credentials;
    limiter;
    constructor(jwt, config, resolver, credentials, limiter) {
        this.jwt = jwt;
        this.config = config;
        this.resolver = resolver;
        this.credentials = credentials;
        this.limiter = limiter;
    }
    async canActivate(execution) {
        const request = execution.switchToHttp().getRequest();
        const credential = (0, integration_token_parser_1.parseIntegrationAuthorization)(request);
        const body = request.body;
        if (body && ['tenantContext', 'tenantUid', 'tenant_uid', 'vpbx_user_uid']
            .some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
            throw new common_1.BadRequestException({ code: 'tenant_context_client_supplied' });
        }
        if (credential.kind === 'integration') {
            const remoteAddress = (0, integration_client_address_1.integrationClientAddress)(request.socket?.remoteAddress, request.headers?.['x-forwarded-for'], this.config.get('INTEGRATION_TRUSTED_PROXY_IPS'));
            await this.limiter.check(remoteAddress, credential.selector);
            let context;
            try {
                context = await this.credentials.authenticate(credential.selector, credential.secret, (0, node_crypto_1.randomUUID)());
            }
            catch (error) {
                await this.limiter.failure(remoteAddress, credential.selector);
                if (error instanceof common_1.HttpException)
                    throw error;
                throw new common_1.ServiceUnavailableException({ code: 'credential_auth_unavailable' });
            }
            this.assertRequestScope(request, context);
            request.tenantContext = context;
            return true;
        }
        let claims;
        try {
            claims = await this.jwt.verifyAsync(credential.token, {
                secret: (0, jwt_secret_1.requireJwtSecret)(this.config),
                issuer: 'krasterisk-v4', audience: 'krasterisk-v4-client',
            });
        }
        catch {
            throw new common_1.UnauthorizedException({ code: 'credential_invalid' });
        }
        const context = await this.resolver.fromUserClaims(claims, (0, node_crypto_1.randomUUID)());
        this.assertRequestScope(request, context);
        request.tenantContext = context;
        return true;
    }
    assertRequestScope(request, context) {
        if (request.params?.tenantUid !== undefined
            && String(context.tenantUid) !== String(request.params.tenantUid)) {
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        }
    }
};
exports.TenantContextGuard = TenantContextGuard;
exports.TenantContextGuard = TenantContextGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService,
        tenant_context_resolver_1.TenantContextResolver,
        integration_credentials_service_1.IntegrationCredentialsService,
        integration_key_rate_limiter_1.IntegrationKeyRateLimiter])
], TenantContextGuard);
//# sourceMappingURL=tenant-context.guard.js.map