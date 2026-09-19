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
exports.CcAiProvider = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * AI Provider profile — a reusable connection config for a vendor
 * (OpenAI Realtime, Qwen, Yandex SpeechKit, Ollama, custom HTTP/WS, …).
 *
 * `user_uid` is the owning tenant. Every provider is tenant-owned.
 */
let CcAiProvider = class CcAiProvider extends sequelize_typescript_1.Model {
};
exports.CcAiProvider = CcAiProvider;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], CcAiProvider.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: false }),
    __metadata("design:type", String)
], CcAiProvider.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.ENUM('online', 'local', 'custom'), allowNull: false }),
    __metadata("design:type", String)
], CcAiProvider.prototype, "kind", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(32), allowNull: false }),
    __metadata("design:type", String)
], CcAiProvider.prototype, "vendor", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(512), allowNull: false }),
    __metadata("design:type", String)
], CcAiProvider.prototype, "endpoint", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('bearer', 'api_key_header', 'none', 'custom'),
        allowNull: true,
        defaultValue: 'bearer',
    }),
    __metadata("design:type", String)
], CcAiProvider.prototype, "auth_type", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", String)
], CcAiProvider.prototype, "encrypted_api_key", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Array)
], CcAiProvider.prototype, "capabilities", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], CcAiProvider.prototype, "defaults", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: false }),
    __metadata("design:type", Object)
], CcAiProvider.prototype, "pricing", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.BOOLEAN, allowNull: false, defaultValue: true }),
    __metadata("design:type", Boolean)
], CcAiProvider.prototype, "enabled", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' }),
    __metadata("design:type", Number)
], CcAiProvider.prototype, "user_uid", void 0);
exports.CcAiProvider = CcAiProvider = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'cc_ai_providers', timestamps: false })
], CcAiProvider);
//# sourceMappingURL=ai-provider.model.js.map