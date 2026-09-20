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
exports.StandaloneCapabilitiesService = void 0;
const common_1 = require("@nestjs/common");
const product_access_service_1 = require("../product-access/product-access.service");
const product_runtime_1 = require("../product-access/product-runtime");
const PROFILE_PRODUCT = {
    'analytics-api': 'speech_analytics',
    'robot-api': 'ai_voice_robots',
};
/** Tenant identity plus computed productRuntime. Default env stays not-installed. */
let StandaloneCapabilitiesService = class StandaloneCapabilitiesService {
    products;
    constructor(products) {
        this.products = products;
    }
    async forContext(context, now = new Date()) {
        const profile = process.env.DB_SCHEMA_PROFILE;
        if (profile !== 'analytics-api' && profile !== 'robot-api') {
            throw new common_1.ServiceUnavailableException({ code: 'profile_mismatch' });
        }
        const product = PROFILE_PRODUCT[profile];
        (0, product_runtime_1.offlineHeartbeatPolicy)();
        const entitlement = await this.products.decide(context.tenantUid, product, now);
        const flags = (0, product_runtime_1.readProcessInstallFlags)();
        const { entitled, expired } = (0, product_runtime_1.entitledFromDecision)(entitlement);
        const runtime = (0, product_runtime_1.resolveProductRuntime)({
            profile, ...flags, entitled, expired, allowed: entitlement.allowed,
        });
        return {
            tenantUid: context.tenantUid,
            principalKind: context.principalKind,
            principalId: context.principalId,
            profile,
            productRuntime: runtime.productRuntime,
            usable: runtime.usable,
            entitlement: {
                product: entitlement.product,
                allowed: entitlement.allowed,
                reason: entitlement.reason,
                source: entitlement.source,
                policyRevision: entitlement.policyRevision,
                evaluatedAt: entitlement.evaluatedAt,
                validUntil: entitlement.validUntil,
                limits: entitlement.limits,
            },
        };
    }
};
exports.StandaloneCapabilitiesService = StandaloneCapabilitiesService;
exports.StandaloneCapabilitiesService = StandaloneCapabilitiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [product_access_service_1.ProductAccessService])
], StandaloneCapabilitiesService);
//# sourceMappingURL=standalone-capabilities.service.js.map