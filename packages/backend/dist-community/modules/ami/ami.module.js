"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmiModule = void 0;
const common_1 = require("@nestjs/common");
const ami_service_1 = require("./ami.service");
const ami_gateway_1 = require("./ami.gateway");
const dialplan_apply_service_1 = require("./dialplan-apply.service");
let AmiModule = class AmiModule {
};
exports.AmiModule = AmiModule;
exports.AmiModule = AmiModule = __decorate([
    (0, common_1.Module)({
        imports: [],
        providers: [ami_service_1.AmiService, ami_gateway_1.AmiGateway, dialplan_apply_service_1.DialplanApplyService],
        exports: [ami_service_1.AmiService, dialplan_apply_service_1.DialplanApplyService],
    })
], AmiModule);
//# sourceMappingURL=ami.module.js.map