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
exports.SaProjectResolver = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const product_resource_authorization_1 = require("../integration-credentials/product-resource.authorization");
const speech_analytics_models_1 = require("./speech-analytics.models");
let SaProjectResolver = class SaProjectResolver {
    projects;
    registry;
    product = 'speech_analytics';
    resourceKind = 'project';
    constructor(projects, registry) {
        this.projects = projects;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
    }
    async findForTenant(tenantUid, resourceId) {
        return this.projects.findOne({ where: { tenant_uid: tenantUid, id: resourceId } });
    }
    async canAct(context, action, resource) {
        const project = resource;
        if (!project || project.tenant_uid !== context.tenantUid)
            return false;
        if (action === 'grant')
            return context.principalKind === 'user';
        if (project.status === 'archived' && action !== 'analytics:read')
            return false;
        return action.startsWith('analytics:');
    }
};
exports.SaProjectResolver = SaProjectResolver;
exports.SaProjectResolver = SaProjectResolver = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(speech_analytics_models_1.SaProject)),
    __metadata("design:paramtypes", [Object, product_resource_authorization_1.ProductResourceResolverRegistry])
], SaProjectResolver);
//# sourceMappingURL=sa-project.resolver.js.map