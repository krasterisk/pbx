"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialplanDryRunModule = void 0;
const common_1 = require("@nestjs/common");
const routes_module_1 = require("../routes/routes.module");
const ivrs_module_1 = require("../ivrs/ivrs.module");
const contexts_module_1 = require("../contexts/contexts.module");
const route_references_module_1 = require("../route-references/route-references.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const dialplan_dry_run_controller_1 = require("./dialplan-dry-run.controller");
const dialplan_dry_run_service_1 = require("./dialplan-dry-run.service");
const dialplan_dry_run_ai_adapter_1 = require("./dialplan-dry-run-ai.adapter");
let DialplanDryRunModule = class DialplanDryRunModule {
};
exports.DialplanDryRunModule = DialplanDryRunModule;
exports.DialplanDryRunModule = DialplanDryRunModule = __decorate([
    (0, common_1.Module)({
        imports: [routes_module_1.RoutesModule, ivrs_module_1.IvrsModule, contexts_module_1.ContextsModule, route_references_module_1.RouteReferencesModule, ai_platform_module_1.AiPlatformModule],
        controllers: [dialplan_dry_run_controller_1.DialplanDryRunController],
        providers: [dialplan_dry_run_service_1.DialplanDryRunService, dialplan_dry_run_ai_adapter_1.DialplanDryRunAiAdapter],
        exports: [dialplan_dry_run_service_1.DialplanDryRunService],
    })
], DialplanDryRunModule);
//# sourceMappingURL=dialplan-dry-run.module.js.map