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
exports.RobotAppModule = exports.ROBOT_API_COMPONENTS = void 0;
const common_1 = require("@nestjs/common");
const standalone_ai_core_module_1 = require("./standalone-ai-core.module");
/** Robot API skeleton; telephony edge and agent runtime arrive in AI-02/AI-07. */
exports.ROBOT_API_COMPONENTS = Object.freeze([
    'tenant-identity', 'ai-connectivity', 'product-access-core',
    'integration-credentials',
]);
let RobotHealthController = class RobotHealthController {
    health() { return { status: 'ok', profile: 'robot-api', productRuntime: 'not-installed' }; }
};
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RobotHealthController.prototype, "health", null);
RobotHealthController = __decorate([
    (0, common_1.Controller)('health')
], RobotHealthController);
let RobotAppModule = class RobotAppModule {
};
exports.RobotAppModule = RobotAppModule;
exports.RobotAppModule = RobotAppModule = __decorate([
    (0, common_1.Module)({
        imports: [standalone_ai_core_module_1.StandaloneAiCoreModule.forProfile('robot-api')],
        controllers: [RobotHealthController],
    })
], RobotAppModule);
//# sourceMappingURL=robot-app.module.js.map