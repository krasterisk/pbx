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
exports.AiChatSettings = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
/**
 * Per-tenant AI Chat confirmation settings (D-25): NOT global cloud_settings —
 * each vpbx_user tenant controls its own destructive-operation confirmation gate.
 * Default OFF (confirm_destructive = 0). Table created by
 * directories schema setup.
 */
let AiChatSettings = class AiChatSettings extends sequelize_typescript_1.Model {
};
exports.AiChatSettings = AiChatSettings;
__decorate([
    sequelize_typescript_1.PrimaryKey,
    sequelize_typescript_1.AutoIncrement,
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER }),
    __metadata("design:type", Number)
], AiChatSettings.prototype, "uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.INTEGER, allowNull: false, unique: true }),
    __metadata("design:type", Number)
], AiChatSettings.prototype, "user_uid", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.TINYINT, allowNull: false, defaultValue: 0 }),
    __metadata("design:type", Number)
], AiChatSettings.prototype, "confirm_destructive", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.JSON, allowNull: true, defaultValue: null }),
    __metadata("design:type", Object)
], AiChatSettings.prototype, "settings", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, field: 'created_at' }),
    __metadata("design:type", Date)
], AiChatSettings.prototype, "created_at", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({ type: sequelize_typescript_1.DataType.DATE, field: 'updated_at' }),
    __metadata("design:type", Date)
], AiChatSettings.prototype, "updated_at", void 0);
exports.AiChatSettings = AiChatSettings = __decorate([
    (0, sequelize_typescript_1.Table)({ tableName: 'ai_chat_settings', timestamps: false, freezeTableName: true })
], AiChatSettings);
//# sourceMappingURL=ai-chat-settings.model.js.map