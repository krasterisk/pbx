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
exports.ProductResourceAuthorization = exports.ProductResourceResolverRegistry = exports.PRODUCT_RESOURCE_RESOLVERS = void 0;
const common_1 = require("@nestjs/common");
exports.PRODUCT_RESOURCE_RESOLVERS = Symbol('PRODUCT_RESOURCE_RESOLVERS');
/** Runtime registry so product modules can register resolvers without a circular import. */
let ProductResourceResolverRegistry = class ProductResourceResolverRegistry {
    items = [];
    register(resolver) {
        if (!this.items.some((item) => item.product === resolver.product
            && item.resourceKind === resolver.resourceKind)) {
            this.items.push(resolver);
        }
    }
    all() {
        return this.items;
    }
};
exports.ProductResourceResolverRegistry = ProductResourceResolverRegistry;
exports.ProductResourceResolverRegistry = ProductResourceResolverRegistry = __decorate([
    (0, common_1.Injectable)()
], ProductResourceResolverRegistry);
/** Default registry is empty until project/deployment modules provide resolvers. */
let ProductResourceAuthorization = class ProductResourceAuthorization {
    resolvers;
    registry;
    constructor(resolvers, registry) {
        this.resolvers = resolvers;
        this.registry = registry;
    }
    async authorize(context, reference) {
        const validPair = (reference.product === 'speech_analytics' && reference.resourceKind === 'project')
            || (reference.product === 'ai_voice_robots' && reference.resourceKind === 'deployment');
        if (!validPair || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(reference.resourceId)
            || !/^[a-z][a-z0-9:_-]{0,63}$/.test(reference.action)) {
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        }
        const resolver = [...this.resolvers, ...this.registry.all()].find((item) => item.product === reference.product
            && item.resourceKind === reference.resourceKind);
        if (!resolver)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        const resource = await resolver.findForTenant(context.tenantUid, reference.resourceId);
        if (!resource)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        if (!await resolver.canAct(context, reference.action, resource)) {
            throw new common_1.ForbiddenException({ code: 'resource_permission_denied' });
        }
    }
};
exports.ProductResourceAuthorization = ProductResourceAuthorization;
exports.ProductResourceAuthorization = ProductResourceAuthorization = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(exports.PRODUCT_RESOURCE_RESOLVERS)),
    __metadata("design:paramtypes", [Array, ProductResourceResolverRegistry])
], ProductResourceAuthorization);
//# sourceMappingURL=product-resource.authorization.js.map