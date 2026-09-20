"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutesModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const route_model_1 = require("./route.model");
const context_include_model_1 = require("./context-include.model");
const webhook_failure_model_1 = require("./webhook-failure.model");
const routes_service_1 = require("./routes.service");
const context_includes_service_1 = require("./context-includes.service");
const route_apply_service_1 = require("./route-apply.service");
const routes_ai_adapter_1 = require("./routes-ai.adapter");
const routes_controller_1 = require("./routes.controller");
const context_includes_controller_1 = require("./context-includes.controller");
const dialplan_webhooks_controller_1 = require("./dialplan-webhooks.controller");
const dialplan_webhooks_service_1 = require("./dialplan-webhooks.service");
const webhook_queue_service_1 = require("./webhook-queue.service");
const ami_module_1 = require("../ami/ami.module");
const time_groups_module_1 = require("../time-groups/time-groups.module");
const context_model_1 = require("../contexts/context.model");
const route_directory_binding_model_1 = require("../directories/route-directory-binding.model");
const directory_model_1 = require("../directories/directory.model");
const directory_field_model_1 = require("../directories/directory-field.model");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const contexts_module_1 = require("../contexts/contexts.module");
const endpoints_module_1 = require("../endpoints/endpoints.module");
const queues_module_1 = require("../queues/queues.module");
const ivrs_module_1 = require("../ivrs/ivrs.module");
const directories_module_1 = require("../directories/directories.module");
const trunks_module_1 = require("../trunks/trunks.module");
const call_groups_module_1 = require("../call-groups/call-groups.module");
// RouteDirectoryBinding/Directory/DirectoryField are registered here so
// RoutesService/RouteApplyService can @InjectModel them without importing
// DirectoriesModule (avoids a module cycle).
let RoutesModule = class RoutesModule {
};
exports.RoutesModule = RoutesModule;
exports.RoutesModule = RoutesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([route_model_1.Route, context_include_model_1.ContextInclude, webhook_failure_model_1.WebhookFailure, context_model_1.Context, route_directory_binding_model_1.RouteDirectoryBinding, directory_model_1.Directory, directory_field_model_1.DirectoryField]),
            ami_module_1.AmiModule,
            time_groups_module_1.TimeGroupsModule,
            ai_platform_module_1.AiPlatformModule,
            contexts_module_1.ContextsModule,
            endpoints_module_1.EndpointsModule,
            queues_module_1.QueuesModule,
            ivrs_module_1.IvrsModule,
            directories_module_1.DirectoriesModule,
            call_groups_module_1.CallGroupsModule,
            (0, common_1.forwardRef)(() => trunks_module_1.TrunksModule),
        ],
        controllers: [routes_controller_1.RoutesController, context_includes_controller_1.ContextIncludesController, dialplan_webhooks_controller_1.DialplanWebhooksController],
        providers: [
            routes_service_1.RoutesService,
            context_includes_service_1.ContextIncludesService,
            route_apply_service_1.RouteApplyService,
            routes_ai_adapter_1.RoutesAiAdapter,
            dialplan_webhooks_service_1.DialplanWebhooksService,
            // String alias for AmiService ModuleRef.get('DialplanWebhooksService')
            {
                provide: 'DialplanWebhooksService',
                useExisting: dialplan_webhooks_service_1.DialplanWebhooksService,
            },
            webhook_queue_service_1.WebhookQueueService,
        ],
        exports: [routes_service_1.RoutesService, context_includes_service_1.ContextIncludesService, route_apply_service_1.RouteApplyService, dialplan_webhooks_service_1.DialplanWebhooksService, webhook_queue_service_1.WebhookQueueService],
    })
], RoutesModule);
//# sourceMappingURL=routes.module.js.map