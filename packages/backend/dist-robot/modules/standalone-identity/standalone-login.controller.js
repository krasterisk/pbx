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
exports.StandaloneLoginController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const auth_dto_1 = require("../auth/dto/auth.dto");
const standalone_login_service_1 = require("./standalone-login.service");
let StandaloneLoginController = class StandaloneLoginController {
    loginService;
    constructor(loginService) {
        this.loginService = loginService;
    }
    login(dto) {
        return this.loginService.login(dto.login, dto.password);
    }
};
exports.StandaloneLoginController = StandaloneLoginController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto]),
    __metadata("design:returntype", void 0)
], StandaloneLoginController.prototype, "login", null);
exports.StandaloneLoginController = StandaloneLoginController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [standalone_login_service_1.StandaloneLoginService])
], StandaloneLoginController);
//# sourceMappingURL=standalone-login.controller.js.map