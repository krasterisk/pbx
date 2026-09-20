"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallGroupsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const call_group_model_1 = require("./call-group.model");
const call_group_member_model_1 = require("./call-group-member.model");
const call_groups_controller_1 = require("./call-groups.controller");
const call_groups_service_1 = require("./call-groups.service");
const ami_module_1 = require("../ami/ami.module");
const endpoints_module_1 = require("../endpoints/endpoints.module");
const route_references_module_1 = require("../route-references/route-references.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const call_groups_ai_adapter_1 = require("./call-groups-ai.adapter");
let CallGroupsModule = class CallGroupsModule {
};
exports.CallGroupsModule = CallGroupsModule;
exports.CallGroupsModule = CallGroupsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([call_group_model_1.CallGroup, call_group_member_model_1.CallGroupMember]),
            ami_module_1.AmiModule,
            endpoints_module_1.EndpointsModule,
            route_references_module_1.RouteReferencesModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        controllers: [call_groups_controller_1.CallGroupsController],
        providers: [call_groups_service_1.CallGroupsService, call_groups_ai_adapter_1.CallGroupsAiAdapter],
        exports: [call_groups_service_1.CallGroupsService],
    })
], CallGroupsModule);
//# sourceMappingURL=call-groups.module.js.map