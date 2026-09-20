"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallbackRequestsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ami_module_1 = require("../ami/ami.module");
const callcenter_module_1 = require("../callcenter/callcenter.module");
const agent_queue_model_1 = require("../callcenter/models/agent-queue.model");
const route_model_1 = require("../routes/route.model");
const user_model_1 = require("../users/user.model");
const callback_dialplan_controller_1 = require("./callback-dialplan.controller");
const callback_request_model_1 = require("./callback-request.model");
const callback_requests_controller_1 = require("./callback-requests.controller");
const callback_requests_service_1 = require("./callback-requests.service");
const callback_scanner_service_1 = require("./callback-scanner.service");
let CallbackRequestsModule = class CallbackRequestsModule {
};
exports.CallbackRequestsModule = CallbackRequestsModule;
exports.CallbackRequestsModule = CallbackRequestsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([callback_request_model_1.CallbackRequest, agent_queue_model_1.CcAgentQueue, user_model_1.User, route_model_1.Route]),
            ami_module_1.AmiModule,
            callcenter_module_1.CallCenterModule,
        ],
        controllers: [callback_dialplan_controller_1.CallbackDialplanController, callback_requests_controller_1.CallbackRequestsController],
        providers: [callback_requests_service_1.CallbackRequestsService, callback_scanner_service_1.CallbackScannerService],
        exports: [callback_requests_service_1.CallbackRequestsService, callback_scanner_service_1.CallbackScannerService],
    })
], CallbackRequestsModule);
//# sourceMappingURL=callback-requests.module.js.map