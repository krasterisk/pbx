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
exports.RouteApplyService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const routes_service_1 = require("./routes.service");
const context_includes_service_1 = require("./context-includes.service");
const dialplan_apply_service_1 = require("../ami/dialplan-apply.service");
const context_model_1 = require("../contexts/context.model");
const directory_policy_dialplan_util_1 = require("../directories/directory-policy-dialplan.util");
/**
 * Orchestrates apply of a route context:
 *   1. Directory policy contexts (dir_policy_{uid}_{vpbx}) for all bindings on the
 *      context's routes — written to krasterisk/directories/dir_{vpbx}.conf, no reload.
 *   2. The route context itself — written to krasterisk/routes/extensions_{ctx}.conf,
 *      single dialplan reload at the end.
 */
let RouteApplyService = class RouteApplyService {
    routesService;
    contextIncludesService;
    dialplanApplyService;
    contextModel;
    constructor(routesService, contextIncludesService, dialplanApplyService, contextModel) {
        this.routesService = routesService;
        this.contextIncludesService = contextIncludesService;
        this.dialplanApplyService = dialplanApplyService;
        this.contextModel = contextModel;
    }
    buildContextName(contextName, vpbxUserUid) {
        const suffix = String(vpbxUserUid);
        return contextName.endsWith(suffix) ? contextName : `${contextName}${suffix}`;
    }
    async applyContext(contextUid, vpbxUserUid, isAdmin = false) {
        const context = await this.contextModel.findOne({ where: { uid: contextUid, user_uid: vpbxUserUid } });
        if (!context)
            throw new common_1.NotFoundException('Context not found');
        const includes = await this.contextIncludesService.getIncludeNames(contextUid, vpbxUserUid);
        const routes = await this.routesService.findAllByContext(contextUid, vpbxUserUid);
        const tenantedContextName = this.buildContextName(context.name, vpbxUserUid);
        const policyCategories = [];
        for (const route of routes) {
            const bindings = route.bindings || [];
            const ordered = bindings.slice().sort((a, b) => a.position - b.position);
            for (const binding of ordered) {
                const directory = binding.directory;
                if (!directory)
                    continue;
                policyCategories.push((0, directory_policy_dialplan_util_1.generatePolicyDialplan)(binding, directory, vpbxUserUid, tenantedContextName, isAdmin));
            }
        }
        if (policyCategories.length > 0) {
            await this.dialplanApplyService.applyCategories(`krasterisk/directories/dir_${vpbxUserUid}.conf`, policyCategories, { reload: false });
        }
        const dialplan = await this.routesService.generateContextDialplan(contextUid, vpbxUserUid, context.name, includes, isAdmin);
        const filename = `krasterisk/routes/extensions_${tenantedContextName}.conf`;
        const result = await this.dialplanApplyService.applyCategories(filename, [{ name: tenantedContextName, lines: dialplan.split('\n') }], { reload: true });
        return { success: result.success, filename, linesApplied: result.linesApplied };
    }
};
exports.RouteApplyService = RouteApplyService;
exports.RouteApplyService = RouteApplyService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, sequelize_1.InjectModel)(context_model_1.Context)),
    __metadata("design:paramtypes", [routes_service_1.RoutesService,
        context_includes_service_1.ContextIncludesService,
        dialplan_apply_service_1.DialplanApplyService, Object])
], RouteApplyService);
//# sourceMappingURL=route-apply.service.js.map