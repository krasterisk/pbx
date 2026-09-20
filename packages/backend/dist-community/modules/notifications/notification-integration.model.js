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
exports.NotificationIntegration = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Tenant-scoped notification channel integration (D-10).
 *
 * Non-secret defaults live in `config`; API tokens / keys are stored in
 * `encrypted_credentials` (AES-256-GCM via encryptSecret).
 */
let NotificationIntegration = class NotificationIntegration extends sequelize_typescript_1.Model {
};
exports.NotificationIntegration = NotificationIntegration;
__decorate([
    (0, sequelize_typescript_1.Column)({ primaryKey: true, autoIncrement: true, type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], NotificationIntegration.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.STRING(128), allowNull: false }),
    __metadata("design:type", String)
], NotificationIntegration.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.ENUM('telegram', 'email', 'whatsapp', 'webhook', 'max', 'vk'),
        allowNull: false,
    }),
    __metadata("design:type", String)
], NotificationIntegration.prototype, "channel", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true }),
    __metadata("design:type", Object)
], NotificationIntegration.prototype, "config", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TEXT, allowNull: true }),
    __metadata("design:type", Object)
], NotificationIntegration.prototype, "encrypted_credentials", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], NotificationIntegration.prototype, "user_uid", void 0);
exports.NotificationIntegration = NotificationIntegration = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'notification_integrations', timestamps: false })
], NotificationIntegration);
//# sourceMappingURL=notification-integration.model.js.map