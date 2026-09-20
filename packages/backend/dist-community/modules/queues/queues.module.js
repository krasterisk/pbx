"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueuesModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const queue_model_1 = require("./queue.model");
const queue_member_model_1 = require("./queue-member.model");
const queues_service_1 = require("./queues.service");
const queues_controller_1 = require("./queues.controller");
const queues_ai_adapter_1 = require("./queues-ai.adapter");
const ami_module_1 = require("../ami/ami.module");
const route_references_module_1 = require("../route-references/route-references.module");
const contexts_module_1 = require("../contexts/contexts.module");
const endpoints_module_1 = require("../endpoints/endpoints.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
let QueuesModule = class QueuesModule {
};
exports.QueuesModule = QueuesModule;
exports.QueuesModule = QueuesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([queue_model_1.Queue, queue_member_model_1.QueueMember]),
            ami_module_1.AmiModule,
            route_references_module_1.RouteReferencesModule,
            contexts_module_1.ContextsModule,
            endpoints_module_1.EndpointsModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        providers: [queues_service_1.QueuesService, queues_ai_adapter_1.QueuesAiAdapter],
        controllers: [queues_controller_1.QueuesController],
        exports: [queues_service_1.QueuesService],
    })
], QueuesModule);
//# sourceMappingURL=queues.module.js.map