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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const auth_service_1 = require("./auth.service");
const auth_dto_1 = require("./dto/auth.dto");
const auth_response_dto_1 = require("./dto/auth-response.dto");
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    // ─── Login ──────────────────────────────────────────────────────────────────
    async login(dto, req) {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            ?? req.socket?.remoteAddress
            ?? '';
        const ua = req.headers['user-agent'] ?? '';
        return this.authService.login(dto.login, dto.password, ip, ua);
    }
    // ─── Register ────────────────────────────────────────────────────────────────
    async register(dto) {
        return this.authService.register(dto.login, dto.password, dto.name, dto.email, dto.companyName);
    }
    // ─── Activation ──────────────────────────────────────────────────────────────
    async activate(dto) {
        return this.authService.activate(dto.login, dto.code);
    }
    // ─── Refresh ─────────────────────────────────────────────────────────────────
    async refresh(dto, req) {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            ?? req.socket?.remoteAddress
            ?? '';
        const ua = req.headers['user-agent'] ?? '';
        return this.authService.refresh(dto.refreshToken, ip, ua);
    }
    // ─── Logout ──────────────────────────────────────────────────────────────────
    async logout(dto) {
        return this.authService.logout(dto.refreshToken);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }) // 10 attempts per minute
    ,
    (0, swagger_1.ApiOperation)({ summary: 'Вход в систему', description: 'Возвращает пару JWT-токенов и данные пользователя' }),
    (0, swagger_1.ApiResponse)({ status: 200, type: auth_response_dto_1.AuthTokenResponse }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Неверный логин или пароль' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 3_600_000 } }) // 5 registrations per hour
    ,
    (0, swagger_1.ApiOperation)({ summary: 'Регистрация (только BOX/OPENSOURCE режим)', description: 'В CLOUD-режиме заблокировано. Провизионирование через /cloud-admin/tenants.' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: auth_response_dto_1.MessageResponse }),
    (0, swagger_1.ApiConflictResponse)({ description: 'Пользователь с таким логином уже существует' }),
    (0, swagger_1.ApiForbiddenResponse)({ description: 'Регистрация отключена (CLOUD mode)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('activation'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Активация аккаунта по коду из email' }),
    (0, swagger_1.ApiResponse)({ status: 200, type: auth_response_dto_1.MessageResponse }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Неверный или истёкший код' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.ActivationDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "activate", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Обновление access-токена через refresh-токен' }),
    (0, swagger_1.ApiResponse)({ status: 200, type: auth_response_dto_1.AuthTokenResponse }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Refresh token недействителен или истёк' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RefreshDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Выход — инвалидация сессии' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '{ success: true }' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LogoutDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map