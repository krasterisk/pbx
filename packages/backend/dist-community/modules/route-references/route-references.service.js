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
exports.RouteReferencesService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const route_model_1 = require("../routes/route.model");
const route_directory_binding_model_1 = require("../directories/route-directory-binding.model");
const ivr_model_1 = require("../ivrs/ivr.model");
const action_reference_util_1 = require("./action-reference.util");
function isNonEmptyRawDialplan(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
let RouteReferencesService = class RouteReferencesService {
    routeModel;
    bindingModel;
    ivrModel;
    constructor(routeModel, bindingModel, ivrModel) {
        this.routeModel = routeModel;
        this.bindingModel = bindingModel;
        this.ivrModel = ivrModel;
    }
    /**
     * Tenant-scoped scan. `vpbxUserUid` MUST come from JWT — never from the client body.
     */
    async findReferences(kind, uid, vpbxUserUid, fieldUid) {
        const { references } = await this.findUsage(kind, uid, vpbxUserUid, fieldUid);
        return references;
    }
    async findUsage(kind, uid, vpbxUserUid, fieldUid) {
        const [routes, bindings, ivrs] = await Promise.all([
            this.routeModel.findAll({
                where: { user_uid: vpbxUserUid },
                attributes: ['uid', 'name', 'extensions', 'active', 'actions', 'raw_dialplan'],
            }),
            kind === 'directory'
                ? this.bindingModel.findAll({ where: { user_uid: vpbxUserUid } })
                : Promise.resolve([]),
            this.ivrModel
                ? this.ivrModel.findAll({
                    where: { user_uid: vpbxUserUid },
                    attributes: ['uid', 'name', 'menu_items'],
                })
                : Promise.resolve([]),
        ]);
        const references = (0, action_reference_util_1.collectActionReferences)(kind, uid, routes, bindings, fieldUid, ivrs);
        const hasRawDialplanRoutes = routes.some((route) => isNonEmptyRawDialplan(route.raw_dialplan));
        return {
            references,
            hasRawDialplanRoutes,
            meta: { hasRawDialplanRoutes },
        };
    }
    /**
     * Server-side delete backstop (D-48 / T-14-04). Same 409 shape as DirectoriesService.remove.
     */
    async assertNotReferenced(kind, uid, vpbxUserUid, message) {
        const ids = Array.isArray(uid) ? uid : [uid];
        const seen = new Set();
        const references = [];
        for (const id of ids) {
            for (const hit of await this.findReferences(kind, id, vpbxUserUid)) {
                const key = `${hit.routeUid}:${hit.actionOrBindingId}:${hit.location}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                references.push(hit);
            }
        }
        if (references.length) {
            throw new common_1.ConflictException({ message, references });
        }
    }
};
exports.RouteReferencesService = RouteReferencesService;
exports.RouteReferencesService = RouteReferencesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(route_model_1.Route)),
    __param(1, (0, sequelize_1.InjectModel)(route_directory_binding_model_1.RouteDirectoryBinding)),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, sequelize_1.InjectModel)(ivr_model_1.Ivr)),
    __metadata("design:paramtypes", [Object, Object, Object])
], RouteReferencesService);
//# sourceMappingURL=route-references.service.js.map