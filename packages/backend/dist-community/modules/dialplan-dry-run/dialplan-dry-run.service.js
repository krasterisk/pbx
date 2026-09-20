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
exports.DialplanDryRunService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@krasterisk/shared");
const routes_service_1 = require("../routes/routes.service");
const ivrs_service_1 = require("../ivrs/ivrs.service");
const contexts_service_1 = require("../contexts/contexts.service");
const route_references_service_1 = require("../route-references/route-references.service");
function asActions(raw) {
    return Array.isArray(raw) ? raw : [];
}
function asMenuItems(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.map((item) => ({
        digit: String(item?.digit ?? ''),
        actions: asActions(item?.actions),
    }));
}
function collectToivrUids(actions, menuItems) {
    const uids = new Set();
    const walk = (nodes) => {
        for (const action of nodes ?? []) {
            if (action.type === 'toivr') {
                const uid = Number(action.params?.ivr_uid);
                if (Number.isFinite(uid))
                    uids.add(uid);
            }
        }
    };
    walk(actions);
    for (const item of menuItems ?? [])
        walk(item.actions);
    return Array.from(uids);
}
let DialplanDryRunService = class DialplanDryRunService {
    routesService;
    ivrsService;
    contextsService;
    routeReferencesService;
    constructor(routesService, ivrsService, contextsService, routeReferencesService) {
        this.routesService = routesService;
        this.ivrsService = ivrsService;
        this.contextsService = contextsService;
        this.routeReferencesService = routeReferencesService;
    }
    /**
     * Deterministic dry-run (D-29). `vpbxUserUid` MUST come from JWT / AI tool arg — never the body.
     */
    async run(vpbxUserUid, input) {
        const toivrUids = collectToivrUids(input.actions, input.menu_items);
        const [ivrs, routes, contexts] = await Promise.all([
            this.ivrsService.findAll(vpbxUserUid),
            this.routesService.findAll(vpbxUserUid),
            this.contextsService.findAll(vpbxUserUid),
            // D-48 / T-14-06: inverse index is tenant-scoped the same way as IVR fetch.
            ...toivrUids.map((uid) => this.routeReferencesService.findReferences('ivr', uid, vpbxUserUid)),
        ]);
        const ivrByUid = new Map(ivrs.map((ivr) => [ivr.uid, ivr]));
        const contextByName = new Map(contexts.map((ctx) => [ctx.name, ctx]));
        const routeByUid = new Map(routes.map((route) => [route.uid, route]));
        const resolveIvr = (ivrUid) => {
            const ivr = ivrByUid.get(ivrUid);
            if (!ivr)
                return undefined;
            return {
                uid: ivr.uid,
                name: ivr.name,
                menu_items: asMenuItems(ivr.menu_items),
            };
        };
        const resolveRoutesInContext = (contextName) => {
            const ctx = contextByName.get(contextName);
            if (!ctx)
                return [];
            return routes
                .filter((route) => route.context_uid === ctx.uid)
                .map((route) => ({
                uid: route.uid,
                name: route.name,
                extensions: Array.isArray(route.extensions) ? route.extensions : [],
                active: route.active,
            }));
        };
        const resolveRoute = (routeUid) => {
            const route = routeByUid.get(routeUid);
            if (!route)
                return undefined;
            return {
                uid: route.uid,
                name: route.name,
                actions: asActions(route.actions),
            };
        };
        const walked = (0, shared_1.walkDialplanGraph)({
            host: input.host,
            actions: input.actions,
            menu_items: input.menu_items,
            scenario: input.scenario,
            ivrChoice: input.ivrChoice,
            callerNumber: input.callerNumber,
            resolveIvr,
            resolveRoutesInContext,
            resolveRoute,
        });
        return this.toDto(walked);
    }
    toDto(walked) {
        return {
            segments: walked.segments,
            breadcrumbs: walked.breadcrumbs,
            hopsUsed: walked.hopsUsed,
            hopLimit: walked.hopLimit,
            outcome: walked.outcome,
            ...(walked.ivrInputs ? { ivrInputs: walked.ivrInputs } : {}),
            ...(walked.reask
                ? {
                    reask: {
                        source: walked.reask.source,
                        keys: walked.reask.keys,
                        askedAfterRun: true,
                        label: String(walked.reask.source),
                    },
                }
                : {}),
        };
    }
};
exports.DialplanDryRunService = DialplanDryRunService;
exports.DialplanDryRunService = DialplanDryRunService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [routes_service_1.RoutesService,
        ivrs_service_1.IvrsService,
        contexts_service_1.ContextsService,
        route_references_service_1.RouteReferencesService])
], DialplanDryRunService);
//# sourceMappingURL=dialplan-dry-run.service.js.map